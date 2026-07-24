'use strict';

/**
 * Текущая погода через Open-Meteo (без API-ключа):
 * воздух — Forecast API, вода — Marine API.
 * Кэш: не чаще 1 раза в час на точку.
 * Точки: Сириус (Имеретинский порт) и Морпорт Сочи (Алексум).
 */

const CACHE_TTL_MS = 60 * 60 * 1000;

/** @type {Map<string, { at: number, data: object }>} */
const cache = new Map();

const PLACES = {
  sirius: {
    id: 'sirius',
    label: 'Сириус (Имеретинский порт)',
    lat: 43.405,
    lon: 39.955,
  },
  sochi: {
    id: 'sochi',
    label: 'Сочи (Морпорт)',
    lat: 43.581,
    lon: 39.719,
  },
};

/** Явный вопрос про текущую погоду / температуру (не про купание). */
const WEATHER_INTENT_RE =
  /погод|температур|сколько\s+градус|градус\w*\s+(на\s+улице|воздух|воды|в\s+воде)|вода\s+(тёпл|тепл|холод)|тёплая\s+вода|теплая\s+вода|прогноз/i;

/** Прямой вопрос про ветер. */
const WIND_INTENT_RE = /ветер|ветрен|шторм|волн\w*/i;

/** Прямой вопрос про погоду на ближайшие 1–3 дня / завтра / послезавтра. */
const FORECAST_DAYS_RE =
  /ближайш[а-яё]*\s+(\d+\s+)?дн|на\s+(1|2|3|один|два|три)\s+дн|через\s+(день|два|три)|прогноз\s+на\s+(завтра|послезавтра)|погода\s+на\s+(завтра|послезавтра)|на\s+завтра|на\s+послезавтра|(^|[^\p{L}])завтра([^\p{L}]|$)|(^|[^\p{L}])послезавтра([^\p{L}]|$)/iu;

/** Запрос прогноза дольше 3 дней — таких данных не даём. */
const LONG_FORECAST_RE =
  /на\s+(4|5|6|7|четыре|пять|шесть|семь|[4-9]\d?|1\d)\s+дн|на\s+недел|на\s+месяц|через\s+(недел|месяц)|прогноз\s+на\s+недел|погода\s+на\s+недел|долгосрочн/i;

/** Только завтра (не «ближайшие дни»). */
const TOMORROW_ONLY_RE = /(?<!после)завтра/i;

/** Только послезавтра. */
const DAY_AFTER_ONLY_RE = /послезавтра/i;

/** Разговор о купании — один раз добавить t° воды «в открытом море». */
const SWIM_INTENT_RE = /купан|купать|искупа|поплавать|в\s+море\s+плав|можно\s+ли\s+в\s+вод/i;

const SOCHI_PLACE_RE = /сочи|морпорт|алекс[уы]м|войков/i;

const OPEN_SEA_WATER_RE = /в\s+открытом\s+море/i;

const WMO_RU = {
  0: 'ясно',
  1: 'преимущественно ясно',
  2: 'переменная облачность',
  3: 'пасмурно',
  45: 'туман',
  48: 'туман',
  51: 'лёгкая морось',
  53: 'морось',
  55: 'сильная морось',
  61: 'небольшой дождь',
  63: 'дождь',
  65: 'сильный дождь',
  66: 'ледяной дождь',
  67: 'сильный ледяной дождь',
  71: 'небольшой снег',
  73: 'снег',
  75: 'сильный снег',
  77: 'снежные зёрна',
  80: 'небольшой ливень',
  81: 'ливень',
  82: 'сильный ливень',
  85: 'снежный ливень',
  86: 'сильный снежный ливень',
  95: 'гроза',
  96: 'гроза с градом',
  99: 'гроза с сильным градом',
};

function isWeatherIntent(text) {
  const t = String(text || '');
  return (
    WEATHER_INTENT_RE.test(t) ||
    WIND_INTENT_RE.test(t) ||
    FORECAST_DAYS_RE.test(t) ||
    LONG_FORECAST_RE.test(t)
  );
}

function isWindIntent(text) {
  return WIND_INTENT_RE.test(String(text || ''));
}

function isForecastDaysIntent(text) {
  const t = String(text || '');
  // «на неделю» и т.п. — не короткий прогноз
  if (isLongForecastIntent(t)) return false;
  return FORECAST_DAYS_RE.test(t);
}

function isLongForecastIntent(text) {
  return LONG_FORECAST_RE.test(String(text || ''));
}

function isSwimIntent(text) {
  return SWIM_INTENT_RE.test(String(text || ''));
}

/** Уже говорили t° воды «в открытом море» в этом диалоге. */
function alreadyMentionedOpenSeaWater(history) {
  return (history || []).some(
    (m) => m && m.role === 'assistant' && OPEN_SEA_WATER_RE.test(String(m.content || ''))
  );
}

function pickPlace(text) {
  const t = String(text || '');
  if (SOCHI_PLACE_RE.test(t)) return PLACES.sochi;
  return PLACES.sirius;
}

function weatherCodeRu(code) {
  const n = Number(code);
  return WMO_RU[n] || 'по данным метеослужбы';
}

function round1(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return Math.round(Number(n) * 10) / 10;
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  return res.json();
}

/**
 * Какой прогноз нужен по тексту клиента.
 * @returns {{ mode: 'single', offset: 1|2, label: string } | { mode: 'range', days: number } | null}
 */
function parseForecastTarget(text) {
  const t = String(text || '');
  if (!isForecastDaysIntent(t)) return null;
  if (DAY_AFTER_ONLY_RE.test(t)) {
    return { mode: 'single', offset: 2, label: 'послезавтра' };
  }
  if (TOMORROW_ONLY_RE.test(t)) {
    return { mode: 'single', offset: 1, label: 'завтра' };
  }
  if (/на\s+(1|один)\s+дн|через\s+день/i.test(t)) {
    return { mode: 'single', offset: 1, label: 'завтра' };
  }
  if (/на\s+(2|два)\s+дн|через\s+два/i.test(t)) {
    return { mode: 'range', days: 2 };
  }
  // «ближайшие дни», «на 3 дня», «через три» и т.п.
  return { mode: 'range', days: 3 };
}

function formatDayLine(daily, index, label) {
  if (!daily || !Array.isArray(daily.time) || index >= daily.time.length) return null;
  const date = String(daily.time[index] || '').slice(5); // MM-DD
  const cond = weatherCodeRu(daily.weather_code[index]);
  const tMax = daily.temperature_2m_max ? round1(daily.temperature_2m_max[index]) : null;
  const title = label ? `${label} (${date})` : date;
  return tMax != null ? `• ${title}: ${cond}, до ${tMax} °C` : `• ${title}: ${cond}`;
}

/**
 * Прогноз по цели: один день (завтра/послезавтра) или диапазон ближайших дней.
 * Сегодня в daily[0] не включаем.
 * @returns {string|null}
 */
function formatForecastDays(daily, target) {
  if (!daily || !Array.isArray(daily.time) || !Array.isArray(daily.weather_code)) return null;
  const tgt = target || { mode: 'range', days: 3 };

  if (tgt.mode === 'single') {
    const line = formatDayLine(daily, tgt.offset, tgt.label);
    if (!line) return null;
    return [`Погода ${tgt.label}:`, line].join('\n');
  }

  const lines = [];
  const n = Math.min(1 + tgt.days, daily.time.length);
  const labels = { 1: 'завтра', 2: 'послезавтра' };
  for (let i = 1; i < n; i++) {
    const line = formatDayLine(daily, i, labels[i] || null);
    if (line) lines.push(line);
  }
  if (!lines.length) return null;
  const title =
    tgt.days === 2 ? 'Прогноз на 2 дня:' : 'Прогноз на 3 дня:';
  return [title, ...lines].join('\n');
}

const LONG_FORECAST_REPLY =
  'Прогноз больше чем на 3 дня у меня нет — на такой срок он часто бывает неточным. Могу сказать погоду сейчас и на ближайшие 3 дня.';


/**
 * @param {{ lat: number, lon: number, id: string, label: string }} place
 */
async function fetchPlaceWeather(place) {
  const cached = cache.get(place.id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ...cached.data, fromCache: true };
  }

  const common = `latitude=${place.lat}&longitude=${place.lon}&timezone=Europe%2FMoscow`;
  const airUrl =
    `https://api.open-meteo.com/v1/forecast?${common}` +
    `&current=temperature_2m,weather_code,wind_speed_10m` +
    `&daily=weather_code,precipitation_sum,wind_speed_10m_max,temperature_2m_max&forecast_days=4`;
  const waterUrl =
    `https://marine-api.open-meteo.com/v1/marine?${common}` +
    `&current=sea_surface_temperature`;

  const [air, water] = await Promise.all([fetchJson(airUrl), fetchJson(waterUrl)]);

  const data = {
    placeId: place.id,
    placeLabel: place.label,
    observedAt: air?.current?.time || water?.current?.time || null,
    airC: round1(air?.current?.temperature_2m),
    waterC: round1(water?.current?.sea_surface_temperature),
    windKmh: round1(air?.current?.wind_speed_10m),
    condition: weatherCodeRu(air?.current?.weather_code),
    daily: air?.daily || null,
    fromCache: false,
  };

  cache.set(place.id, { at: Date.now(), data });
  return data;
}

/** Предзагрузка при открытии чата (не чаще 1 раза в час). Без сообщений клиенту. */
async function prefetchWeather(textOrPlace) {
  const place =
    typeof textOrPlace === 'object' && textOrPlace?.id
      ? textOrPlace
      : pickPlace(textOrPlace || '');
  return fetchPlaceWeather(place);
}

function openSeaWaterLine(waterC) {
  if (waterC == null) return null;
  return `Температура воды в открытом море — около ${waterC} °C.`;
}

/**
 * Краткий блок для системного промпта (не выдумывать погоду).
 * Ветер — только если клиент сам спросил. Про ухудшение не говорить никогда.
 * @returns {Promise<string>}
 */
async function weatherPromptBlock(text) {
  try {
    const t = String(text || '');
    const place = pickPlace(t);
    const w = await fetchPlaceWeather(place);
    const target = parseForecastTarget(t);
    const parts = [];

    if (target && target.mode === 'single') {
      const fc = formatForecastDays(w.daily, target);
      if (fc) parts.push(fc);
      parts.push(
        `Ответь ТОЛЬКО про ${target.label} (воздух/условия на этот день). Не добавляй «сейчас», другие дни и не говори про ухудшение погоды.`
      );
    } else {
      parts.push(`Актуальная погода (${w.placeLabel}, Open-Meteo, МСК):`);
      if (w.airC != null) parts.push(`воздух ${w.airC} °C (${w.condition})`);
      if (w.waterC != null) parts.push(`вода в открытом море ${w.waterC} °C`);
      if (isWindIntent(t) && w.windKmh != null) parts.push(`ветер ${w.windKmh} км/ч`);
      if (isLongForecastIntent(t)) {
        parts.push(LONG_FORECAST_REPLY);
        const fc = formatForecastDays(w.daily, { mode: 'range', days: 3 });
        if (fc) parts.push(fc);
      } else if (target) {
        const fc = formatForecastDays(w.daily, target);
        if (fc) parts.push(fc);
      }
      parts.push(
        'По умолчанию НЕ говори про ветер. НИКОГДА не говори про ухудшение погоды / «может ухудшиться». Прогноз дальше 3 дней не давай — скажи, что таких данных нет и долгосрочный прогноз неточен. Не выдумывай цифры.'
      );
    }
    if (isSwimIntent(t)) {
      parts.push(
        'Клиент про купание: если ещё не говорил в этом диалоге — один раз укажи температуру воды формулировкой «в открытом море».'
      );
    }
    return parts.join(' ');
  } catch (err) {
    console.error('[weather] prompt block failed:', err.message);
    return 'Живая погода сейчас недоступна — не выдумывай градусы; направь к капитану.';
  }
}

/**
 * Ответ на вопрос о погоде: по умолчанию воздух + вода.
 * «Завтра» / «послезавтра» — только этот день. Ветер / диапазон — по прямому вопросу.
 * Про ухудшение не говорим никогда.
 * @returns {Promise<string|null>}
 */
async function buildWeatherReply(text) {
  try {
    const t = String(text || '');
    const place = pickPlace(t);
    const w = await fetchPlaceWeather(place);
    const wantWind = isWindIntent(t);
    const target = parseForecastTarget(t);
    const wantLong = isLongForecastIntent(t);
    const lines = [];

    if (wantLong) {
      lines.push(LONG_FORECAST_REPLY);
      const fc = formatForecastDays(w.daily, { mode: 'range', days: 3 });
      if (fc) lines.push(fc);
      return lines.join('\n');
    }

    // «Погода на завтра/послезавтра» — только этот день, без «сейчас»
    if (target && target.mode === 'single') {
      const fc = formatForecastDays(w.daily, target);
      if (fc) return fc;
      return `Пока нет данных по погоде ${target.label} в районе «${w.placeLabel}».`;
    }

    if (wantWind && !WEATHER_INTENT_RE.test(t) && !target) {
      lines.push(
        w.windKmh != null
          ? `Сейчас в районе «${w.placeLabel}» ветер — около ${w.windKmh} км/ч.`
          : `Сейчас данные по ветру в районе «${w.placeLabel}» недоступны.`
      );
      return lines.join('\n');
    }

    lines.push(`Сейчас в районе «${w.placeLabel}»:`);
    if (w.airC != null) lines.push(`• воздух — около ${w.airC} °C, ${w.condition}`);
    if (w.waterC != null) lines.push(`• вода в открытом море — около ${w.waterC} °C`);
    if (wantWind && w.windKmh != null) lines.push(`• ветер — около ${w.windKmh} км/ч`);
    if (target) {
      const fc = formatForecastDays(w.daily, target);
      if (fc) lines.push(fc);
    }
    return lines.join('\n');
  } catch (err) {
    console.error('[weather] reply failed:', err.message);
    return null;
  }
}

/**
 * Добавка про воду при купании (один раз за диалог).
 * @returns {Promise<string|null>}
 */
async function buildSwimWaterNote(text, history) {
  if (!isSwimIntent(text)) return null;
  if (alreadyMentionedOpenSeaWater(history)) return null;
  try {
    const w = await fetchPlaceWeather(pickPlace(text));
    return openSeaWaterLine(w.waterC);
  } catch (err) {
    console.error('[weather] swim note failed:', err.message);
    return null;
  }
}

module.exports = {
  PLACES,
  CACHE_TTL_MS,
  isWeatherIntent,
  isWindIntent,
  isForecastDaysIntent,
  isLongForecastIntent,
  isSwimIntent,
  alreadyMentionedOpenSeaWater,
  pickPlace,
  parseForecastTarget,
  formatForecastDays,
  fetchPlaceWeather,
  prefetchWeather,
  openSeaWaterLine,
  weatherPromptBlock,
  buildWeatherReply,
  buildSwimWaterNote,
};

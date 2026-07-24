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

/** Явный вопрос про погоду / температуру / ветер (не про купание). */
const WEATHER_INTENT_RE =
  /погод|температур|сколько\s+градус|градус\w*\s+(на\s+улице|воздух|воды|в\s+воде)|вода\s+(тёпл|тепл|холод)|тёплая\s+вода|теплая\s+вода|ветер\b|шторм|волн\w*|прогноз/i;

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
  return WEATHER_INTENT_RE.test(String(text || ''));
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

function severity(code) {
  const n = Number(code);
  if (Number.isNaN(n)) return 0;
  if (n >= 95) return 4;
  if (n >= 80 || (n >= 61 && n <= 67)) return 3;
  if (n >= 51) return 2;
  if (n >= 3) return 1;
  return 0;
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
 * Ухудшение в ближайшие 2–3 дня относительно сегодня.
 * @returns {string|null}
 */
function detectWorsening(daily) {
  if (!daily || !Array.isArray(daily.weather_code) || daily.weather_code.length < 2) return null;
  const codes = daily.weather_code;
  const precip = daily.precipitation_sum || [];
  const wind = daily.wind_speed_10m_max || [];
  const todaySev = severity(codes[0]);
  const todayPrecip = Number(precip[0]) || 0;
  const todayWind = Number(wind[0]) || 0;

  let worse = false;
  for (let i = 1; i <= 3 && i < codes.length; i++) {
    const sev = severity(codes[i]);
    const p = Number(precip[i]) || 0;
    const w = Number(wind[i]) || 0;
    if (sev >= 3 && sev > todaySev) worse = true;
    if (p >= 5 && p > todayPrecip + 2) worse = true;
    if (w >= 40 && w > todayWind + 10) worse = true;
  }
  if (!worse) return null;
  return 'В ближайшие 2–3 дня погода может ухудшиться — дату выхода лучше уточнить у капитана.';
}

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
    `&daily=weather_code,precipitation_sum,wind_speed_10m_max&forecast_days=4`;
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
    worseningWarning: detectWorsening(air?.daily),
    fromCache: false,
  };

  cache.set(place.id, { at: Date.now(), data });
  return data;
}

/** Предзагрузка при открытии чата (не чаще 1 раза в час). */
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
 * @returns {Promise<string>}
 */
async function weatherPromptBlock(text) {
  try {
    const place = pickPlace(text);
    const w = await fetchPlaceWeather(place);
    const parts = [`Актуальная погода (${w.placeLabel}, Open-Meteo, МСК):`];
    if (w.airC != null) parts.push(`воздух ${w.airC} °C (${w.condition})`);
    if (w.waterC != null) parts.push(`вода в открытом море ${w.waterC} °C`);
    if (w.windKmh != null) parts.push(`ветер ${w.windKmh} км/ч`);
    if (w.worseningWarning) parts.push(w.worseningWarning);
    parts.push('Решение о выходе — у капитана (погода/порт). Не выдумывай другие цифры.');
    if (isSwimIntent(text)) {
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
 * Готовый ответ на вопрос о погоде (воздух + вода + предупреждение).
 * @returns {Promise<string|null>}
 */
async function buildWeatherReply(text) {
  try {
    const place = pickPlace(text);
    const w = await fetchPlaceWeather(place);
    const lines = [`Сейчас в районе «${w.placeLabel}»:`];
    if (w.airC != null) lines.push(`• воздух — около ${w.airC} °C, ${w.condition}`);
    if (w.waterC != null) lines.push(`• вода в открытом море — около ${w.waterC} °C`);
    if (w.windKmh != null) lines.push(`• ветер — около ${w.windKmh} км/ч`);
    if (w.worseningWarning) lines.push(w.worseningWarning);
    lines.push('Выход в море при плохой погоде или закрытом порте могут перенести — уточняйте у капитана.');
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
  isSwimIntent,
  alreadyMentionedOpenSeaWater,
  pickPlace,
  fetchPlaceWeather,
  prefetchWeather,
  openSeaWaterLine,
  weatherPromptBlock,
  buildWeatherReply,
  buildSwimWaterNote,
};

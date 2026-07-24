'use strict';

/**
 * Текущая погода через Open-Meteo (без API-ключа):
 * воздух — Forecast API, вода — Marine API.
 * Точки: Сириус (Имеретинский порт) и Морпорт Сочи (Алексум).
 */

const CACHE_TTL_MS = 15 * 60 * 1000;

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

const WEATHER_INTENT_RE =
  /погод|температур|сколько\s+градус|градус\w*\s+(на\s+улице|воздух|воды|в\s+воде)|вода\s+(тёпл|тепл|холод)|тёплая\s+вода|теплая\s+вода|ветер\b|шторм|волн\w*|можно\s+ли\s+купат|купаться\s+сегодня|сегодня\s+купат/i;

const SOCHI_PLACE_RE = /сочи|морпорт|алекс[уы]м|войков/i;

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
 * @param {{ lat: number, lon: number, id: string, label: string }} place
 */
async function fetchPlaceWeather(place) {
  const cached = cache.get(place.id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const common = `latitude=${place.lat}&longitude=${place.lon}&timezone=Europe%2FMoscow`;
  const airUrl =
    `https://api.open-meteo.com/v1/forecast?${common}` +
    `&current=temperature_2m,weather_code,wind_speed_10m`;
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
  };

  cache.set(place.id, { at: Date.now(), data });
  return data;
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
    if (w.waterC != null) parts.push(`вода ${w.waterC} °C`);
    if (w.windKmh != null) parts.push(`ветер ${w.windKmh} км/ч`);
    parts.push('Решение о выходе — у капитана (погода/порт). Не выдумывай другие цифры.');
    return parts.join(' ');
  } catch (err) {
    console.error('[weather] prompt block failed:', err.message);
    return 'Живая погода сейчас недоступна — не выдумывай градусы; направь к капитану.';
  }
}

/**
 * Готовый ответ клиенту.
 * @returns {Promise<string|null>}
 */
async function buildWeatherReply(text) {
  try {
    const place = pickPlace(text);
    const w = await fetchPlaceWeather(place);
    const lines = [`Сейчас в районе «${w.placeLabel}»:`];
    if (w.airC != null) lines.push(`• воздух — около ${w.airC} °C, ${w.condition}`);
    if (w.waterC != null) lines.push(`• вода — около ${w.waterC} °C`);
    if (w.windKmh != null) lines.push(`• ветер — около ${w.windKmh} км/ч`);
    lines.push('Выход в море при плохой погоде или закрытом порте могут перенести — уточняйте у капитана.');
    return lines.join('\n');
  } catch (err) {
    console.error('[weather] reply failed:', err.message);
    return null;
  }
}

module.exports = {
  PLACES,
  isWeatherIntent,
  pickPlace,
  fetchPlaceWeather,
  weatherPromptBlock,
  buildWeatherReply,
};

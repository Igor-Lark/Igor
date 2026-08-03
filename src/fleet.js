'use strict';

/**
 * Флот с вместимостью: для запросов «на N человек» — только суда с maxGuests ≥ N.
 * Ответ собирается детерминированно, чтобы LLM не подсовывал меньшие суда «для примера».
 */

const FLEET = [
  {
    id: 'infinity',
    name: 'Инфинити',
    kind: 'boat',
    label: 'катер «Инфинити»',
    maxGuests: 6,
    port: 'sirius',
    portLabel: 'Сириус',
    price: '8 000 ₽/час',
    speed: 'до 70 км/ч',
    note: 'вейкборд или водные лыжи, капитан-инструктор',
  },
  {
    id: 'rinker232',
    name: 'Rinker 232',
    kind: 'boat',
    label: 'катер «Rinker 232»',
    maxGuests: 7,
    port: 'sirius',
    portLabel: 'Сириус',
    price: '7 000 ₽/час',
    length: '7,5 м',
    speed: '12 / 25 узлов (≈ 22–46 км/ч)',
  },
  {
    id: 'sirius',
    name: 'Сириус',
    kind: 'yacht',
    label: 'яхта «Сириус»',
    maxGuests: 7,
    port: 'sirius',
    portLabel: 'Сириус',
    price: '8 000 ₽/час (утром 6:00–12:00 — 7 500)',
  },
  {
    id: 'boston',
    name: 'Бостон',
    kind: 'boat',
    label: 'катер «Бостон»',
    maxGuests: 7,
    port: 'sirius',
    portLabel: 'Сириус',
    price: '8 000 ₽/час',
  },
  {
    id: 'popeye',
    name: 'Моряк-Попай',
    kind: 'catamaran',
    label: 'катамаран «Моряк-Попай»',
    maxGuests: 8,
    port: 'sirius',
    portLabel: 'Сириус',
    price: 'от 20 000 ₽ / мин. 3 часа',
  },
  {
    id: 'lilu',
    name: 'Лилу',
    kind: 'yacht',
    label: '«Лилу» (парусная яхта)',
    maxGuests: 10,
    port: 'sirius',
    portLabel: 'Сириус',
    price: '16 000 ₽/час',
  },
  {
    id: 'bruno',
    name: 'Бруно',
    kind: 'yacht',
    label: 'яхта «Бруно»',
    maxGuests: 11,
    port: 'sirius',
    portLabel: 'Сириус',
    price: '14 500 ₽/час',
  },
  {
    id: 'tigger',
    name: 'Tigger',
    kind: 'yacht',
    label: 'яхта «Tigger»',
    maxGuests: 12,
    maxGuestsLabel: 'до 10–12',
    port: 'sirius',
    portLabel: 'Сириус',
    price: '45 000 ₽/час',
  },
  {
    id: 'aleksum',
    name: 'Алексум',
    kind: 'yacht',
    label: 'яхта «Алексум»',
    maxGuests: 10,
    port: 'sochi',
    portLabel: 'Морпорт Сочи',
    price: '40 000 ₽/час',
  },
];

const WORD_TO_NUM = {
  один: 1,
  одна: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  пятнадцать: 15,
  двадцать: 20,
};

const CAPACITY_INTENT_RE =
  /(?:на|для|под)\s+(\d{1,2}|[а-яё]+)\s*(?:человек|чел\.?|гост|персон)|(?:нас|компания|компанией|гостей|человек)\s+(\d{1,2}|[а-яё]+)|вместимост\w*.{0,20}(\d{1,2})|(\d{1,2})\s*(?:человек|чел\.?|гост)/i;

const YACHT_ONLY_RE = /яхт/i;
const BOAT_ONLY_RE = /катер/i;
const CATAMARAN_ONLY_RE = /катамаран/i;
const SIRIUS_PORT_RE = /сириус|адлер|имеретин/i;
const SOCHI_PORT_RE = /сочи|морпорт|войков/i;

function parseGuestWord(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= 30 ? n : null;
  }
  return WORD_TO_NUM[s] || null;
}

/**
 * @returns {number|null}
 */
function extractGuestCount(text) {
  const t = String(text || '');
  const m = t.match(CAPACITY_INTENT_RE);
  if (!m) return null;
  for (let i = 1; i < m.length; i++) {
    const n = parseGuestWord(m[i]);
    if (n != null) return n;
  }
  return null;
}

function isCapacityIntent(text) {
  return extractGuestCount(text) != null;
}

/**
 * @returns {'yacht'|'boat'|'catamaran'|null}
 */
function extractKindFilter(text) {
  const t = String(text || '');
  if (YACHT_ONLY_RE.test(t) && !BOAT_ONLY_RE.test(t) && !CATAMARAN_ONLY_RE.test(t)) return 'yacht';
  if (BOAT_ONLY_RE.test(t) && !YACHT_ONLY_RE.test(t)) return 'boat';
  if (CATAMARAN_ONLY_RE.test(t)) return 'catamaran';
  return null;
}

/**
 * @returns {'sirius'|'sochi'|null}
 */
function extractPortFilter(text) {
  const t = String(text || '');
  if (SOCHI_PORT_RE.test(t) && !SIRIUS_PORT_RE.test(t)) return 'sochi';
  if (SIRIUS_PORT_RE.test(t) && !SOCHI_PORT_RE.test(t)) return 'sirius';
  return null;
}

/**
 * @param {number} guests
 * @param {{ kind?: string|null, port?: string|null }} [filters]
 */
function filterFleet(guests, filters = {}) {
  const n = Number(guests);
  if (!Number.isFinite(n) || n < 1) return [];
  return FLEET.filter((v) => {
    if (v.maxGuests < n) return false;
    if (filters.kind && v.kind !== filters.kind) return false;
    if (filters.port && v.port !== filters.port) return false;
    return true;
  }).sort((a, b) => {
    if (a.port !== b.port) return a.port === 'sirius' ? -1 : 1;
    return a.maxGuests - b.maxGuests || a.name.localeCompare(b.name, 'ru');
  });
}

function capacityLabel(v) {
  return v.maxGuestsLabel || `до ${v.maxGuests}`;
}

function vesselLine(v) {
  const parts = [`• ${v.label} — ${capacityLabel(v)}`, v.portLabel, v.price];
  if (v.length) parts.push(v.length);
  if (v.speed) parts.push(v.speed);
  if (v.note) parts.push(v.note);
  let line = parts.join(', ');
  if (v.offWebsite) line += ' (подробности — у Олега или Натальи)';
  return line;
}

/**
 * Готовый ответ клиенту.
 * @returns {string|null}
 */
function buildCapacityReply(text) {
  const guests = extractGuestCount(text);
  if (guests == null) return null;

  const kind = extractKindFilter(text);
  const port = extractPortFilter(text);
  const matches = filterFleet(guests, { kind, port });

  const kindWord =
    kind === 'yacht' ? 'яхт' : kind === 'boat' ? 'катеров' : kind === 'catamaran' ? 'катамаранов' : 'судов';
  const portWord =
    port === 'sirius' ? ' в Сириусе' : port === 'sochi' ? ' в Морпорту Сочи' : '';

  if (!matches.length) {
    // Если сузили до «яхт» и пусто — попробуем все типы
    if (kind) {
      const any = filterFleet(guests, { port });
      if (any.length) {
        const lines = any.map((v) => vesselLine(v));
        return [
          `Среди ${kindWord}${portWord} на ${guests} человек подходящих нет, но есть другие суда:`,
          ...lines,
          'Могу подсказать подробнее по любому варианту — спрашивайте.',
        ].join('\n');
      }
    }
    return `На ${guests} человек${portWord} подходящих ${kindWord} в базе сейчас нет. Уточните число гостей или порт — подберём другой вариант.`;
  }

  const lines = matches.map((v) => vesselLine(v));
  return [
    `Для компании из ${guests} человек${portWord} подходят:`,
    ...lines,
    'Суда с меньшей вместимостью не предлагаю. Могу рассказать подробнее про любой вариант — спрашивайте.',
  ].join('\n');
}

/**
 * Жёсткий блок в системный промпт (если ответ всё же через LLM).
 */
function capacityPromptBlock(text) {
  const guests = extractGuestCount(text);
  if (guests == null) return null;
  const kind = extractKindFilter(text);
  const port = extractPortFilter(text);
  const matches = filterFleet(guests, { kind, port });
  const lines = matches.map((v) => {
    const parts = [`- ${v.label}: ${capacityLabel(v)}`, v.portLabel, v.price];
    if (v.length) parts.push(v.length);
    if (v.speed) parts.push(v.speed);
    let line = parts.join(', ');
    if (v.offWebsite) line += ' (подробности — у Олега или Натальи)';
    return line;
  });
  return [
    `Клиент просит варианты на ${guests} человек${kind === 'yacht' ? ' (яхты)' : ''}${port === 'sirius' ? ' в Сириусе' : port === 'sochi' ? ' в Сочи' : ''}.`,
    'Называй ТОЛЬКО суда из списка ниже. Суда с меньшей вместимостью НЕ упоминай вообще.',
    'Если в списке есть «Лилу» — пиши «Лилу» (парусная яхта).',
    matches.length ? lines.join('\n') : 'Подходящих судов нет — скажи честно.',
    'Не пиши «капитан Олег», если речь не только про яхту «Сириус». Не заканчивай обязательно контактами.',
  ].join('\n');
}

module.exports = {
  FLEET,
  isCapacityIntent,
  extractGuestCount,
  extractKindFilter,
  extractPortFilter,
  filterFleet,
  buildCapacityReply,
  capacityPromptBlock,
};

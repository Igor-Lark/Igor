'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

/** Схема прохода к причалу «Сириус», линия 1 (Имеретинский порт) */
const SIRIUS_MAP_FILE = path.join(__dirname, '..', 'public', 'maps', 'sirius-line1.jpg');

/** Вопросы про адрес/проход — НЕ путать с парусными яхтами. */
const MAP_INTENT_RE =
  /схем|маршрут|как\s+пройт|как\s+добрат|как\s+дойти|как\s+вас\s+найти|как\s+найти|где\s+вас\s+найти|где\s+вы(?:$|[\s,.!?«»"'])|где\s+причал|где\s+встрет|где\s+найти|где\s+находит|как\s+нас\s+найти|линия\s*1|парусная\s*1|ул\.?\s*парусн|парковк|легенд|где\s+ялт|где\s+катер|где\s+сириус|имеритин|адрес\s+причал|где\s+стоит|как\s+к\s+вам/i;

/** Вопросы про парусный флот — схема не нужна. */
const SAIL_FLEET_RE =
  /парусник|парусн\w*\s+яхт|яхт\w*\s+парусн|под\s+парус|парусн\w*\s+(катер|судно|лодк)|есть\s+ли\s+парус|какие\s+парус/i;

/** Упоминание «Алексум» / порт Сочи / Войкова. */
const ALEKSUM_RE = /алекс[уы]м|alexum|войков|морпорт\s*сочи|порт\s*сочи/i;

function hasSiriusMapFile() {
  try {
    return fs.existsSync(SIRIUS_MAP_FILE);
  } catch {
    return false;
  }
}

/**
 * Как пройти к «Алексуму» — только Морпорт Сочи, без схемы Сириуса.
 */
function isAleksumDirectionsIntent(text) {
  const t = String(text || '');
  if (!ALEKSUM_RE.test(t)) return false;
  return (
    MAP_INTENT_RE.test(t) ||
    /где|адрес|причал|найти|пройт|добрат|стоит|как\s+к/i.test(t)
  );
}

/** Схема Сириуса — только если это не «Алексум» и не вопрос про парусники. */
function isMapIntent(text) {
  const t = String(text || '');
  if (SAIL_FLEET_RE.test(t)) return false;
  if (isAleksumDirectionsIntent(t)) return false;
  return MAP_INTENT_RE.test(t);
}

/** Публичный URL схемы (после деплоя с PUBLIC_URL) */
function siriusMapPublicUrl() {
  if (!config.publicUrl || config.publicUrl.includes('ваш-домен')) return '';
  return `${config.publicUrl}/maps/sirius-line1.jpg`;
}

function siriusMapCaption() {
  const url = siriusMapPublicUrl();
  const lines = [
    '📍 Причал в Сириусе: Парусная 1, линия 1 (Имеретинский порт).',
    'Там все катера и яхты, кроме «Алексум».',
    'Ориентир — от отеля «Легенда» (Морской бульвар, 1) → через парковку к морю → линия 1.',
    'Приходите за 10 минут до выхода.',
  ];
  if (url) lines.push(`Схема: ${url}`);
  return lines.join('\n');
}

function aleksumDirectionsReply() {
  return [
    '📍 Яхта «Алексум» стоит в порту Сочи: Войкова, 1 (Морпорт, линия 1).',
    'Это не Имеретинский порт и не Сириус — схему Сириуса сюда не присылаем.',
    'Приходите за 10 минут до выхода.',
  ].join('\n');
}

module.exports = {
  SIRIUS_MAP_FILE,
  hasSiriusMapFile,
  isMapIntent,
  isAleksumDirectionsIntent,
  siriusMapPublicUrl,
  siriusMapCaption,
  aleksumDirectionsReply,
};

'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

/** Схема прохода к причалу «Сириус», линия 1 */
const SIRIUS_MAP_FILE = path.join(__dirname, '..', 'public', 'maps', 'sirius-line1.jpg');

const MAP_INTENT_RE =
  /схем|маршрут|как\s+пройт|как\s+добрат|как\s+дойти|как\s+вас\s+найти|как\s+найти|где\s+вас\s+найти|где\s+вы\b|где\s+причал|где\s+встрет|где\s+найти|где\s+находит|как\s+нас\s+найти|линия\s*1|парусн|парковк|легенд|где\s+ялт|где\s+катер|где\s+сириус|имеритин|адрес\s+причал|где\s+стоит|как\s+к\s+вам/i;

function hasSiriusMapFile() {
  try {
    return fs.existsSync(SIRIUS_MAP_FILE);
  } catch {
    return false;
  }
}

function isMapIntent(text) {
  return MAP_INTENT_RE.test(String(text || ''));
}

/** Публичный URL схемы (после деплоя с PUBLIC_URL) */
function siriusMapPublicUrl() {
  if (!config.publicUrl || config.publicUrl.includes('ваш-домен')) return '';
  return `${config.publicUrl}/maps/sirius-line1.jpg`;
}

function siriusMapCaption() {
  const url = siriusMapPublicUrl();
  const lines = [
    '📍 Причал катера «Сириус»: Сириус, Парусная 1, линия 1 (Имеретинский порт).',
    'Ориентир — от отеля «Легенда» (Морской бульвар, 1) → через парковку к морю → линия 1.',
    'Приходите за 10 минут до выхода.',
  ];
  if (url) lines.push(`Схема: ${url}`);
  return lines.join('\n');
}

module.exports = {
  SIRIUS_MAP_FILE,
  hasSiriusMapFile,
  isMapIntent,
  siriusMapPublicUrl,
  siriusMapCaption,
};

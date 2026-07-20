'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

/** Схема прохода к причалу «Сириус», линия 1 */
const SIRIUS_MAP_FILE = path.join(__dirname, '..', 'public', 'maps', 'sirius-line1.jpg');

const MAP_INTENT_RE =
  /схем|как\s+пройт|как\s+добрат|где\s+причал|где\s+встрет|где\s+найти|линия\s*1|парусн|парковк|легенд|как\s+дойти|где\s+ялт|где\s+катер|где\s+сириус|имеритин/i;

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

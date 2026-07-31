'use strict';

const fs = require('fs');
const path = require('path');

const PRICING_PATH = path.join(__dirname, '..', 'data', 'pricing-from-site.json');

const DEFAULT_CALC = {
  aPanelM2: 0.62,
  panelPriceRub: 1550,
  panelPriceM2Rub: 2500,
  tilePriceM2Rub: 1300,
  foamPriceRub: 800,
  foamM2PerCan: 6,
  groutPriceRub: 1450,
  groutBagKg: 25,
};

function readPricingFile() {
  try {
    return JSON.parse(fs.readFileSync(PRICING_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/** Цены для server-calc и подсказок в промпте (источник: marmara-pro.ru → data/pricing-from-site.json). */
function getCalcPricing() {
  const file = readPricingFile();
  if (!file || !file.calc) return { ...DEFAULT_CALC, syncedAt: null, source: 'https://marmara-pro.ru/termo' };
  return { ...DEFAULT_CALC, ...file.calc, syncedAt: file.syncedAt || null, source: file.source || 'https://marmara-pro.ru/termo' };
}

function fmtRub(n) {
  const x = Math.round(Number(n) || 0);
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

module.exports = {
  PRICING_PATH,
  DEFAULT_CALC,
  getCalcPricing,
  fmtRub,
  readPricingFile,
};

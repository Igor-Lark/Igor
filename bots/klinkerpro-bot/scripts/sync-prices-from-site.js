#!/usr/bin/env node
'use strict';

/**
 * Подтягивает цены термопанелей и клинкерной плитки с каталога marmara-pro.ru/termo
 * (Tilda Store API). Результат: data/pricing-from-site.json + правки site-termo-catalog.md.
 *
 *   cd bots/klinkerpro-bot && npm run prices:sync
 */
const fs = require('fs');
const path = require('path');

const BOT_DIR = path.join(__dirname, '..');
const OUT_JSON = path.join(BOT_DIR, 'data', 'pricing-from-site.json');
const CATALOG_MD = path.join(BOT_DIR, 'knowledge', 'site-termo-catalog.md');
const STORE_PART_UID = process.env.TILDA_STORE_PART_UID || '840610530462';
const SITE_URL = 'https://marmara-pro.ru/termo';
const API_URL = `https://store.tildaapi.com/api/getproductslist/?storepartuid=${STORE_PART_UID}`;

function parseRub(text) {
  if (!text) return null;
  const m = String(text).replace(/\u00a0/g, ' ').match(/(\d[\d\s]*)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/\s/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function charMap(product) {
  const map = {};
  for (const c of product.characteristics || []) {
    map[c.title] = c.value;
  }
  return map;
}

function priceFromDescr(descr) {
  const m = String(descr || '').match(/(\d[\d\s]*)\s*₽/);
  return m ? parseRub(m[1]) : null;
}

function fmtRub(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

async function fetchProducts() {
  const res = await fetch(API_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Tilda API ${res.status}`);
  const data = await res.json();
  if (!data.products || !Array.isArray(data.products)) {
    throw new Error('Tilda API: нет products');
  }
  return data.products;
}

function buildFromProducts(products) {
  const termopanels = [];
  const tileProducts = [];
  let panelPrices = [];
  let panelM2Prices = [];
  let tileM2Prices = [];

  for (const p of products) {
    const title = (p.title || '').trim();
    const ch = charMap(p);
    const isTermo = /^термопанел/i.test(title);
    const isTile = /клинкерная плитка/i.test(title);

    if (isTermo) {
      const panelRub = parseRub(ch['Стоимость панели']) || priceFromDescr(p.descr);
      const m2Rub = parseRub(ch['(стоимость 1 м2)']) || priceFromDescr(p.descr);
      if (panelRub) panelPrices.push(panelRub);
      if (m2Rub) panelM2Prices.push(m2Rub);
      termopanels.push({ title, panelRub, m2Rub, url: p.url || null });
    } else if (isTile) {
      const m2Rub =
        parseRub(ch['(стоимость 1 м2)']) ||
        parseRub(ch['Стоимость']) ||
        priceFromDescr(p.descr);
      if (m2Rub) tileM2Prices.push(m2Rub);
      tileProducts.push({ title, priceM2Rub: m2Rub, url: p.url || null });
    }
  }

  const panelPriceRub = panelPrices.length ? Math.min(...panelPrices) : null;
  const panelPriceM2Rub = panelM2Prices.length ? Math.min(...panelM2Prices) : null;
  const tilePriceM2Rub = tileM2Prices.length ? Math.min(...tileM2Prices) : null;

  if (!panelPriceRub || !panelPriceM2Rub) {
    throw new Error('Не удалось прочитать цены термопанелей с сайта');
  }

  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
  } catch {
    /* first run */
  }
  const prevCalc = prev.calc || {};

  const calc = {
    aPanelM2: prevCalc.aPanelM2 ?? 0.62,
    panelPriceRub,
    panelPriceM2Rub,
    tilePriceM2Rub: tilePriceM2Rub ?? prevCalc.tilePriceM2Rub ?? 1300,
    foamPriceRub: prevCalc.foamPriceRub ?? 800,
    foamM2PerCan: prevCalc.foamM2PerCan ?? 6,
    groutPriceRub: prevCalc.groutPriceRub ?? 1450,
    groutBagKg: prevCalc.groutBagKg ?? 25,
  };

  return {
    source: SITE_URL,
    tildaStorePartUid: STORE_PART_UID,
    syncedAt: new Date().toISOString(),
    calc,
    termopanels,
    tileProducts,
  };
}

function patchCatalogMd(payload) {
  if (!fs.existsSync(CATALOG_MD)) return;
  let md = fs.readFileSync(CATALOG_MD, 'utf8');
  const { calc, termopanels, tileProducts, syncedAt } = payload;

  md = md.replace(
    /\| \*\*Цена за 1 термопанель\*\* \| \*\*[^|]+\*\* \|/,
    `| **Цена за 1 термопанель** | **${fmtRub(calc.panelPriceRub)} ₽** |`
  );
  md = md.replace(
    /\| \*\*Цена за 1 м²\*\* \(на карточке\) \| \*\*[^|]+\*\* \|/,
    `| **Цена за 1 м²** (на карточке) | **${fmtRub(calc.panelPriceM2Rub)} ₽/м²** |`
  );
  md = md.replace(
    /(\*\*[\d\s]+ ₽\/шт\.|\*\*1 550 ₽\/шт\.)/,
    `**${fmtRub(calc.panelPriceRub)} ₽/шт.`
  );
  md = md.replace(
    /\| \*\*Цена\*\* \| \*\*[^|]+\*\* \|/,
    `| **Цена** | **${fmtRub(calc.tilePriceM2Rub)} ₽/м²** |`
  );

  const termoBlock =
    termopanels
      .filter((t) => t.panelRub != null)
      .map((t) => {
        const same =
          t.panelRub === calc.panelPriceRub && t.m2Rub === calc.panelPriceM2Rub;
        return same
          ? `- ${t.title}`
          : `- ${t.title} — ${fmtRub(t.panelRub)} ₽/шт., ${fmtRub(t.m2Rub)} ₽/м²`;
      })
      .join('\n') + '\n';

  md = md.replace(
    /<!-- prices-sync:termopanels:start -->[\s\S]*?<!-- prices-sync:termopanels:end -->/,
    `<!-- prices-sync:termopanels:start -->\n${termoBlock}<!-- prices-sync:termopanels:end -->`
  );

  const tileBlock =
    tileProducts.map((t) => `- ${t.title}`).join('\n') + '\n';

  md = md.replace(
    /<!-- prices-sync:tile:start -->[\s\S]*?<!-- prices-sync:tile:end -->/,
    `<!-- prices-sync:tile:start -->\n${tileBlock}<!-- prices-sync:tile:end -->`
  );

  md = md.replace(
    /Обновление прайса каталога:.*/,
    `Обновление прайса: \`npm run prices:sync\` (данные с ${SITE_URL}, API Tilda store part \`${STORE_PART_UID}\`). Последняя синхронизация в репозитории: ${syncedAt.slice(0, 10)}.`
  );

  fs.writeFileSync(CATALOG_MD, md, 'utf8');
}

async function main() {
  const products = await fetchProducts();
  const payload = buildFromProducts(products);
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  patchCatalogMd(payload);
  console.log('OK:', OUT_JSON);
  console.log(
    'Термопанели:',
    payload.calc.panelPriceRub,
    '₽/шт.,',
    payload.calc.panelPriceM2Rub,
    '₽/м²; плитка:',
    payload.calc.tilePriceM2Rub,
    '₽/м²'
  );
}

main().catch((err) => {
  console.error('sync-prices-from-site:', err.message || err);
  process.exit(1);
});

'use strict';

const FACADE_CALC_VERSION = 6;
const A_PANEL = 0.62;
const PANEL_PRICE = 1550;
const PANEL_PRICE_M2 = 2500;
const FOAM_M2_PER_CAN = 6;
const FOAM_PRICE = 800;
const GROUT_KG_PER_M2 = 2.8 * 1.15;
const GROUT_BAG_KG = 25;
const GROUT_PRICE = 1450;
const ANCHORS_PER_PANEL = 6;

function parseNum(s) {
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDimToken(tok) {
  let t = String(tok).toLowerCase().trim();
  t = t.replace(/\s*(?:м\.?|метр(?:а|ов)?)\s*$/i, '').trim();
  if (t === 'полтора' || t === 'полторы') return 1.5;
  if (t === 'два' || t === 'две') return 2;
  if (t === 'три') return 3;
  return parseNum(t);
}

function parseCountToken(s) {
  if (s == null || s === '') return 1;
  const t = String(s).toLowerCase().trim();
  if (/^\d+$/.test(t)) return Math.max(1, parseInt(t, 10));
  if (/^(два|две|двое)$/.test(t)) return 2;
  if (/^три$/.test(t)) return 3;
  if (/^четыре$/.test(t)) return 4;
  if (/^пять$/.test(t)) return 5;
  return 1;
}

/**
 * Размер проёма в метрах. Без «м» значения ≥10 считаем сантиметрами (120×80 окно).
 * @returns {{ w: number, h: number, area: number } | null}
 */
function parseOpeningSizeMeters(aStr, bStr, unitHint) {
  let w = parseDimToken(aStr);
  let h = parseDimToken(bStr);
  if (!w || !h) return null;
  const u = String(unitHint || '').toLowerCase();
  if (/см|^cm$/i.test(u)) {
    w /= 100;
    h /= 100;
  } else if (/^м|m$/i.test(u)) {
    /* уже метры */
  } else if (w >= 10 || h >= 10) {
    w /= 100;
    h /= 100;
  }
  return { w, h, area: w * h };
}

const DIM_TOK = '(?:полтора|полторы|два|две|три|четыре|пять|\\d+(?:[.,]\\d+)?)';
const SIZE_PAIR_RE = new RegExp(
  `${DIM_TOK}\\s*(?:м|см|mm|мм)?\\s*[x×х\\*]\\s*${DIM_TOK}\\s*(?:м|см|mm|мм)?`,
  'i'
);
const SIZE_NA_RE = new RegExp(
  `${DIM_TOK}\\s*(?:м|см|mm|мм)?\\s+на\\s+${DIM_TOK}(?:\\s*(?:м|см|mm|мм|метр(?:а|ов)?))?`,
  'i'
);

function findOpeningSizeInPart(part, kind) {
  const pLow = part.toLowerCase();
  const key = kind === 'door' ? 'двер' : 'окн';
  const idx = pLow.indexOf(key);
  if (idx < 0) return null;
  const after = part.slice(idx);
  let m = after.match(SIZE_PAIR_RE);
  if (m) {
    const bits = m[0].split(/[x×х\*]/i);
    if (bits.length >= 2) {
      return parseOpeningSizeMeters(bits[0], bits[1], '');
    }
  }
  m = after.match(SIZE_NA_RE);
  if (m) {
    const inner = m[0].split(/\s+на\s+/i);
    if (inner.length >= 2) {
      return parseOpeningSizeMeters(inner[0], inner[1], '');
    }
  }
  return null;
}

function countFromOpeningPart(part, kind) {
  const p = part.toLowerCase();
  const word = kind === 'door' ? 'двер' : 'окн';
  if (!p.includes(word)) return null;

  const m1 = p.match(
    new RegExp(
      '(\\d+|два|две|двое|три|четыре|пять)\\s*(?:шт\\.?\\s*)?(?:' + (kind === 'door' ? 'двер' : 'окн') + ')',
      'i'
    )
  );
  if (m1) return parseCountToken(m1[1]);

  if (kind === 'door' && /\b(двое|две|два)\b/.test(p) && /двер/.test(p)) return 2;
  if (kind === 'window' && /\b(три)\b/.test(p) && /окн/.test(p)) return 3;

  return 1;
}

/**
 * @param {string} text
 * @returns {{ items: { kind: string, count: number, w: number, h: number, areaEach: number, areaTotal: number }[], totalArea: number }}
 */
function parseOpeningsFromText(text) {
  const items = [];
  const raw = String(text);
  const parts = raw.split(/[,;\n]+|(?=\s+\d+\s+окн)|(?=\s+(?:двое|две|два|три|\d+)\s+двер)/i);

  for (const part of parts) {
    const pLow = part.toLowerCase();
    const isDoor = /двер/.test(pLow);
    const isWindow = /окн/.test(pLow);
    if (!isDoor && !isWindow) continue;

    if (isDoor) {
      const size = findOpeningSizeInPart(part, 'door');
      if (!size) continue;
      const count = countFromOpeningPart(part, 'door');
      items.push({
        kind: 'door',
        count,
        w: size.w,
        h: size.h,
        areaEach: size.area,
        areaTotal: count * size.area,
      });
    }
    if (isWindow) {
      const size = findOpeningSizeInPart(part, 'window');
      if (!size) continue;
      const count = countFromOpeningPart(part, 'window');
      items.push({
        kind: 'window',
        count,
        w: size.w,
        h: size.h,
        areaEach: size.area,
        areaTotal: count * size.area,
      });
    }
  }

  const totalArea = items.reduce((s, it) => s + it.areaTotal, 0);
  return { items, totalArea };
}

/**
 * @param {{ role: string, content: string }[]} history
 */
function extractOpeningsFromHistory(history) {
  const merged = { items: [], totalArea: 0 };
  for (const msg of history) {
    if (msg.role !== 'user') continue;
    const block = parseOpeningsFromText(msg.content);
    if (block.items.length) {
      merged.items = merged.items.concat(block.items);
      merged.totalArea += block.totalArea;
    }
  }
  return merged.items.length ? merged : null;
}

/**
 * @param {string} text
 * @returns {{ L: number, W: number, H: number } | null}
 */
function parseDimensionsFromText(text) {
  const raw = String(text);
  const t = raw.toLowerCase().replace(/\s+/g, ' ');

  let m = t.match(
    /(\d+(?:[.,]\d+)?)\s*(?:м\.?)?\s*[x×х\*]\s*(\d+(?:[.,]\d+)?)\s*(?:м\.?)?\s*[x×х\*]\s*(\d+(?:[.,]\d+)?)/
  );
  if (m) {
    const L = parseNum(m[1]);
    const W = parseNum(m[2]);
    const H = parseNum(m[3]);
    if (L && W && H) return { L, W, H };
  }

  m = t.match(
    /(\d+(?:[.,]\d+)?)\s*(?:м\.?)?\s*на\s*(\d+(?:[.,]\d+)?)\s*(?:м\.?)?\s*на\s*(\d+(?:[.,]\d+)?)/
  );
  if (m) {
    const L = parseNum(m[1]);
    const W = parseNum(m[2]);
    const H = parseNum(m[3]);
    if (L && W && H) return { L, W, H };
  }

  const len = t.match(/(?:длин[аы]|length)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/);
  const wid = t.match(/(?:ширин[аы]|width)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/);
  const hei = t.match(/(?:высот[аы](?:\s*стен)?|height)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/);
  if (len && wid && hei) {
    const L = parseNum(len[1]);
    const W = parseNum(wid[1]);
    const H = parseNum(hei[1]);
    if (L && W && H) return { L, W, H };
  }

  m = t.match(
    /(\d+(?:[.,]\d+)?)\s*(?:м\.?)?\s*[,;\s]\s*(\d+(?:[.,]\d+)?)\s*(?:м\.?)?\s*[,;\s]\s*(\d+(?:[.,]\d+)?)\s*(?:м\.?)?/
  );
  if (m) {
    const L = parseNum(m[1]);
    const W = parseNum(m[2]);
    const H = parseNum(m[3]);
    if (L && W && H) return { L, W, H };
  }

  return null;
}

function parseLabeledDimensions(text) {
  const t = String(text).toLowerCase().replace(/\s+/g, ' ');
  const len = t.match(/(?:длин[аы]|length)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/);
  const wid = t.match(/(?:ширин[аы]|width)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/);
  const hei = t.match(/(?:высот[аы](?:\s*стен)?|height)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/);
  const out = {};
  if (len) {
    const L = parseNum(len[1]);
    if (L) out.L = L;
  }
  if (wid) {
    const W = parseNum(wid[1]);
    if (W) out.W = W;
  }
  if (hei) {
    const H = parseNum(hei[1]);
    if (H) out.H = H;
  }
  return out;
}

/**
 * @param {{ role: string, content: string }[]} history
 * @returns {{ L: number, W: number, H: number } | null}
 */
function extractDimensionsFromHistory(history) {
  let latest = null;
  const merged = { L: null, W: null, H: null };
  for (const msg of history) {
    if (msg.role !== 'user') continue;
    const d = parseDimensionsFromText(msg.content);
    if (d) latest = d;
    const part = parseLabeledDimensions(msg.content);
    if (part.L) merged.L = part.L;
    if (part.W) merged.W = part.W;
    if (part.H) merged.H = part.H;
  }
  if (latest) return latest;
  if (merged.L && merged.W && merged.H) {
    return { L: merged.L, W: merged.W, H: merged.H };
  }
  return null;
}

function wallAreaGross(L, W, H) {
  return 2 * (L + W) * H;
}

function fmtInt(n) {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * @param {number} L
 * @param {number} W
 * @param {number} H
 * @param {ReturnType<typeof parseOpeningsFromText> | null} [openings]
 */
function computeEstimate(L, W, H, openings) {
  const S_gross = wallAreaGross(L, W, H);
  const S_openings = openings && openings.totalArea > 0 ? openings.totalArea : 0;
  const S = Math.max(0, S_gross - S_openings);
  const N = Math.ceil(S / A_PANEL);
  const S_order = N * A_PANEL;
  const N_foam = Math.ceil(S_order / FOAM_M2_PER_CAN);
  const M_grout = S_order * GROUT_KG_PER_M2;
  const N_grout = Math.ceil(M_grout / GROUT_BAG_KG);
  const N_anchors = N * ANCHORS_PER_PANEL;

  return {
    L,
    W,
    H,
    S_gross,
    S_openings,
    openingItems: openings ? openings.items : [],
    S,
    N,
    S_order,
    costPanels: N * PANEL_PRICE,
    N_foam,
    costFoam: N_foam * FOAM_PRICE,
    N_grout,
    costGrout: N_grout * GROUT_PRICE,
    N_anchors,
  };
}

/**
 * @param {{ role: string, content: string }[]} history
 * @returns {ReturnType<typeof computeEstimate> | null}
 */
function estimateFromHistory(history) {
  const dims = extractDimensionsFromHistory(history);
  if (!dims) return null;
  const openings = extractOpeningsFromHistory(history);
  return computeEstimate(dims.L, dims.W, dims.H, openings);
}

function fmtArea(n) {
  return Number(n)
    .toFixed(2)
    .replace('.', ',')
    .replace(/,00$/, '');
}

function buildClientItogo(est) {
  const sOrder = fmtArea(est.S_order);
  return [
    'Итого (ориентир):',
    `— Термопанели: ${est.N} шт. · ${fmtInt(est.costPanels)} ₽`,
    `— Клей-пена: ${est.N_foam} балл. (800 мл) · ${fmtInt(est.costFoam)} ₽ (на ${est.N} термопанелей, ${sOrder} кв.м)`,
    `— Затирка: ${est.N_grout} меш. (25 кг) · ${fmtInt(est.costGrout)} ₽ (на ту же площадь клинкера)`,
    `— Дюбели: ${fmtInt(est.N_anchors)} шт.`,
  ].join('\n');
}

/**
 * Готовый текст расчёта для клиента (сервер), когда проёмы уже распознаны.
 * @param {ReturnType<typeof computeEstimate>} est
 */
function buildCalcClientNarrative(est) {
  const lines = [
    `Приблизительный расчёт **с вычетом проёмов** для дома ${est.L}×${est.W}×${est.H} м (4 стены):`,
    '',
    `Площадь стен: 2×(${est.L}+${est.W})×${est.H} = ${fmtArea(est.S_gross)} кв.м.`,
    `Проёмы (двери и окна — вычитаем из стены): ${formatOpeningLines(est.openingItems)}.`,
    `Сумма проёмов: ${fmtArea(est.S_openings)} кв.м.`,
    `Под термопанели, клей и затирку: ${fmtArea(est.S_gross)} − ${fmtArea(est.S_openings)} = **${fmtArea(est.S)} кв.м**.`,
    '',
    buildClientItogo(est),
  ];
  return lines.join('\n');
}

/** В сообщении есть размеры дверей/окон (для дожима парсера). */
function userMessageHasOpeningSpecs(text) {
  const t = String(text).toLowerCase();
  if (!/двер|окн/.test(t)) return false;
  return /(полтора|\d+(?:[.,]\d+)?).*(?:на|[x×х\*])/.test(t);
}

function userRequestsFacadeCalc(text) {
  return /расч[её]т|посчит|прикидк|смет|площад|термопанел|размер.*дом|дом\s+\d/i.test(String(text));
}

/**
 * Пересчёт с проёмами из последнего сообщения, если в history merge не сработал.
 * @param {{ role: string, content: string }[]} history
 * @param {string} [lastUserText]
 */
function resolveEstimateForChat(history, lastUserText) {
  let est = estimateFromHistory(history);
  if (!est || !lastUserText || est.S_openings > 0) return est;
  if (!userMessageHasOpeningSpecs(lastUserText)) return est;
  const openings = parseOpeningsFromText(lastUserText);
  if (!openings.totalArea) return est;
  const dims =
    extractDimensionsFromHistory(history) || parseDimensionsFromText(lastUserText);
  if (!dims) return est;
  return computeEstimate(dims.L, dims.W, dims.H, openings);
}

/** Если проёмы распознаны — ответ только с сервера (модель часто игнорирует вычет). */
function shouldUseServerCalcNarrative(est, lastUserText) {
  if (!est || !(est.S_openings > 0 && est.openingItems && est.openingItems.length)) {
    return false;
  }
  if (lastUserText && userRequestsFacadeCalc(lastUserText)) return true;
  return est.S_openings > 0;
}

function formatOpeningLines(items) {
  if (!items || !items.length) return '';
  return items
    .map((it) => {
      const label = it.kind === 'door' ? 'двери' : 'окна';
      return `${it.count} ${label} ${fmtArea(it.w)}×${fmtArea(it.h)} м → ${fmtArea(it.areaTotal)} кв.м`;
    })
    .join('; ');
}

/**
 * @param {ReturnType<typeof computeEstimate>} est
 * @returns {string}
 */
function buildCalcSystemBlock(est) {
  const { L, W, H, S_gross, S_openings, S, N, N_foam, N_grout, N_anchors, S_order } = est;
  const sum = L + W;
  const lines = [
    '=== РАСЧЁТ СЕРВЕРА (только для модели, клиенту не цитировать этот блок и не приводить чужие «контрольные» размеры) ===',
    `Размеры клиента: длина ${L} м, ширина ${W} м, высота стен ${H} м (4 стены).`,
    `Площадь стен (брутто): S_gross = 2×(${L}+${W})×${H} = 2×${sum}×${H} = ${fmtArea(S_gross)} кв.м.`,
  ];

  if (S_openings > 0) {
    lines.push(
      'Проёмы (двери и окна — это вычитаемые проёмы в стене, не «декоративные элементы»):',
      formatOpeningLines(est.openingItems),
      `S_proemov = ${fmtArea(S_openings)} кв.м.`,
      `Площадь под термопанели: S = S_gross − S_proemov = ${fmtArea(S)} кв.м — только эту площадь использовать для N панелей, клея и затирки.`
    );
  } else {
    lines.push(
      `Площадь под термопанели: S = ${fmtArea(S)} кв.м (проёмы клиент не указал — расчёт **без вычета проёмов**; в ответе так и сказать и спросить окна/двери).`
    );
  }

  lines.push(
    `Термопанели: N = ceil(${fmtArea(S)}/${String(A_PANEL).replace('.', ',')}) = ${N} шт.; S_order = N×${String(A_PANEL).replace('.', ',')} = ${fmtArea(S_order)} кв.м (для клея и затирки — от S_order после вычета проёмов; **запас на подрезку в расчёт не закладывать**).`,
    `Клей-пена: ceil(S_order/6) = ${N_foam} балл. × 800 ₽ = ${fmtInt(est.costFoam)} ₽.`,
    `Затирка: ${N_grout} меш. × 1 450 ₽ = ${fmtInt(est.costGrout)} ₽.`,
    `Термопанели ₽: ${N} × 1 550 = ${fmtInt(est.costPanels)} ₽.`,
    `Дюбели: ${N_anchors} шт. (6×${N}).`,
    'Клиенту: без учебных примеров и без чужих размеров. Обязательно блок «Итого (ориентир)» — каждая позиция с количеством и **₽** (дюбели — только шт.). Клей и затирка **всегда** вместе с термопанелями, от расчётного N после вычета проёмов (если проёмы были).',
    'Текст для клиента (можно дословно):',
    buildClientItogo(est)
  );

  return lines.join('\n');
}

/** Исправляет неверный итог в строке с формулой площади. */
function fixWallAreaInReply(reply, est) {
  if (!est || !reply) return reply;
  const { L, W, H, S, S_gross } = est;
  const areaTarget = est.S_openings > 0 ? S : S_gross;
  let s = String(reply);

  const wrongAfterEquals = new RegExp(
    `(2\\s*[×x\\*]\\s*\\(${L}\\s*\\+\\s*${W}\\)\\s*[×x\\*]\\s*${H}|2\\s*[×x\\*]\\s*\\(${L}\\s*\\+\\s*${W}\\)\\s*[×x\\*]\\s*${H}|площад[ья].*?2\\s*[×x\\*].*?)\\s*=\\s*\\d+(?:[.,]\\d+)?\\s*(?:кв\\.\\s*м|м²|м2)`,
    'gi'
  );
  s = s.replace(wrongAfterEquals, (line) =>
    line.replace(/=\s*\d+(?:[.,]\d+)?\s*(?=кв\.|м²|м2|$)/i, `= ${areaTarget} `)
  );

  s = s.replace(
    new RegExp(
      `(2\\s*[×x\\*]\\s*\\(\\s*${L}\\s*\\+\\s*${W}\\s*\\)\\s*[×x\\*]\\s*${H}\\s*=\\s*)\\d+(?:[.,]\\d+)?`,
      'gi'
    ),
    `$1${areaTarget}`
  );

  return s;
}

/** Подставляет проверенный блок «Итого» с ₽ и клеем/затиркой от N панелей. */
function injectServerItogo(reply, est) {
  if (!est || !reply) return reply;
  const block = buildClientItogo(est);
  let s = String(reply).trimEnd();

  const itogoRe =
    /Итого\s*\(ориентир\)\s*:[\s\S]*?(?=\n\n(?:Чтобы|Для более|Уточн|Если удобно|Проём|Окон|Контакт|\+\s*7|https?:)|$)/i;
  if (itogoRe.test(s)) {
    return s.replace(itogoRe, block).trim();
  }

  const insertBefore = s.search(
    /\n(?:Чтобы уточн|Для более точн|Уточните проёмы|Сколько окон|Если удобно|\+\s*7\s*\(|https:\/\/marmara)/i
  );
  if (insertBefore > 0) {
    return (s.slice(0, insertBefore).trimEnd() + '\n\n' + block + '\n' + s.slice(insertBefore).trimStart()).trim();
  }
  return s + '\n\n' + block;
}

/**
 * Убирает хвост с дублирующимися оговорками и контактами менеджера.
 */
function stripCalcFooterTail(text) {
  let s = String(text);
  const res = [
    /\n\s*\*\*Данный\s+расч[её]т\s+являет/i,
    /\n\s*Данный\s+расч[её]т\s+являет/i,
    /\n\s*Для\s+получения\s+более\s+точн/i,
    /\n\s*Для\s+точной\s+сметы/i,
    /\n\s*Если\s+удобно\s+—/i,
  ];
  let cut = s.length;
  for (const re of res) {
    const m = re.exec(s);
    if (m && m.index < cut) cut = m.index;
  }
  return s.slice(0, cut).trimEnd();
}

function buildCalcFooter(opts) {
  return [
    '**Данный расчёт является ориентировочным.**',
    '',
    'Для получения более точной сметы и подбора фактуры свяжитесь с менеджером КлинкерПрофи:',
    `- Телефон: ${opts.managerPhone}`,
    `- Контакты и мессенджеры: ${opts.contactsUrl}`,
  ].join('\n');
}

/**
 * После расчёта — одна оговорка (жирная) и один блок контактов менеджера.
 * @param {string} reply
 * @param {{ hasCalc: boolean, managerPhone: string, contactsUrl: string }} opts
 */
function appendCalcDisclaimer(reply, opts) {
  if (!opts || !opts.hasCalc || !reply) return reply;
  const body = stripCalcFooterTail(reply);
  return body + '\n\n' + buildCalcFooter(opts);
}

module.exports = {
  FACADE_CALC_VERSION,
  parseDimensionsFromText,
  parseOpeningsFromText,
  extractOpeningsFromHistory,
  extractDimensionsFromHistory,
  computeEstimate,
  estimateFromHistory,
  resolveEstimateForChat,
  userRequestsFacadeCalc,
  buildCalcSystemBlock,
  buildCalcClientNarrative,
  shouldUseServerCalcNarrative,
  buildClientItogo,
  fixWallAreaInReply,
  injectServerItogo,
  appendCalcDisclaimer,
  wallAreaGross,
};

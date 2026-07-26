'use strict';

const A_PANEL = 0.54;
const PANEL_PRICE = 1460;
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
  const hei = t.match(/(?:высот[аы]|height)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/);
  if (len && wid && hei) {
    const L = parseNum(len[1]);
    const W = parseNum(wid[1]);
    const H = parseNum(hei[1]);
    if (L && W && H) return { L, W, H };
  }

  return null;
}

/**
 * @param {{ role: string, content: string }[]} history
 * @returns {{ L: number, W: number, H: number } | null}
 */
function extractDimensionsFromHistory(history) {
  let latest = null;
  for (const msg of history) {
    if (msg.role !== 'user') continue;
    const d = parseDimensionsFromText(msg.content);
    if (d) latest = d;
  }
  return latest;
}

function wallAreaGross(L, W, H) {
  return 2 * (L + W) * H;
}

function fmtInt(n) {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function computeEstimate(L, W, H) {
  const S = wallAreaGross(L, W, H);
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
  return computeEstimate(dims.L, dims.W, dims.H);
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
 * @param {ReturnType<typeof computeEstimate>} est
 * @returns {string}
 */
function buildCalcSystemBlock(est) {
  const { L, W, H, S, N, N_foam, N_grout, N_anchors, S_order } = est;
  const sum = L + W;
  return [
    '=== РАСЧЁТ СЕРВЕРА (только для модели, клиенту не цитировать этот блок и не приводить чужие «контрольные» размеры) ===',
    `Размеры клиента: длина ${L} м, ширина ${W} м, высота стен ${H} м (4 стены, без вычета проёмов).`,
    `Площадь стен: S = 2×(${L}+${W})×${H} = 2×${sum}×${H} = ${S} кв.м — только этот итог площади.`,
    `Термопанели: N = ceil(${S}/0,54) = ${N} шт.; S_order = N×0,54 = ${S_order} кв.м (для клея и затирки).`,
    `Клей-пена: ceil(S_order/6) = ${N_foam} балл. × 800 ₽ = ${fmtInt(est.costFoam)} ₽.`,
    `Затирка: ${N_grout} меш. × 1 450 ₽ = ${fmtInt(est.costGrout)} ₽.`,
    `Термопанели ₽: ${N} × 1 460 = ${fmtInt(est.costPanels)} ₽.`,
    `Дюбели: ${N_anchors} шт. (6×${N}).`,
    'Клиенту: без учебных примеров и без чужих размеров. Обязательно блок «Итого (ориентир)» — каждая позиция с количеством и **₽** (дюбели — только шт.). Клей и затирка **всегда** вместе с термопанелями, от расчётного N.',
    'Текст для клиента (можно дословно):',
    buildClientItogo(est),
  ].join('\n');
}

/** Исправляет неверный итог в строке с формулой площади. */
function fixWallAreaInReply(reply, est) {
  if (!est || !reply) return reply;
  const { L, W, H, S } = est;
  let s = String(reply);

  const wrongAfterEquals = new RegExp(
    `(2\\s*[×x\\*]\\s*\\(${L}\\s*\\+\\s*${W}\\)\\s*[×x\\*]\\s*${H}|2\\s*[×x\\*]\\s*\\(${L}\\s*\\+\\s*${W}\\)\\s*[×x\\*]\\s*${H}|площад[ья].*?2\\s*[×x\\*].*?)\\s*=\\s*\\d+(?:[.,]\\d+)?\\s*(?:кв\\.\\s*м|м²|м2)`,
    'gi'
  );
  s = s.replace(wrongAfterEquals, (line) =>
    line.replace(/=\s*\d+(?:[.,]\d+)?\s*(?=кв\.|м²|м2|$)/i, `= ${S} `)
  );

  s = s.replace(
    new RegExp(
      `(2\\s*[×x\\*]\\s*\\(\\s*${L}\\s*\\+\\s*${W}\\s*\\)\\s*[×x\\*]\\s*${H}\\s*=\\s*)\\d+(?:[.,]\\d+)?`,
      'gi'
    ),
    `$1${S}`
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
 * После расчёта — жирная пометка и направление к менеджеру.
 * @param {string} reply
 * @param {{ hasCalc: boolean, managerPhone: string, contactsUrl: string }} opts
 */
function appendCalcDisclaimer(reply, opts) {
  if (!opts || !opts.hasCalc || !reply) return reply;
  if (/данный\s+расч[её]т\s+являет/i.test(reply)) return reply;

  const block = [
    '',
    '**Данный расчёт является ориентировочным.**',
    '',
    `Для точной сметы, замера и подбора фактуры обратитесь к **менеджеру КлинкерПрофи**: ${opts.managerPhone} или ${opts.contactsUrl}`,
  ].join('\n');

  return String(reply).trimEnd() + block;
}

module.exports = {
  parseDimensionsFromText,
  extractDimensionsFromHistory,
  computeEstimate,
  estimateFromHistory,
  buildCalcSystemBlock,
  buildClientItogo,
  fixWallAreaInReply,
  injectServerItogo,
  appendCalcDisclaimer,
  wallAreaGross,
};

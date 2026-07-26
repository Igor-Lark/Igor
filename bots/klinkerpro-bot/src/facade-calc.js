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

/**
 * @param {ReturnType<typeof computeEstimate>} est
 * @returns {string}
 */
function buildCalcSystemBlock(est) {
  const { L, W, H, S, N, N_foam, N_grout, N_anchors } = est;
  const sum = L + W;
  return [
    '=== РАСЧЁТ СЕРВЕРА (обязательно, арифметика уже проверена) ===',
    `Размеры клиента: длина ${L} м, ширина ${W} м, высота стен ${H} м (прямоугольный дом, 4 стены, без вычета проёмов).`,
    `Площадь стен: S = 2×(${L}+${W})×${H} = 2×${sum}×${H} = **${S}** кв.м.`,
    `Запрещено писать другой итог площади (типичная ошибка модели: ${S - 20} или ${S + 20} — неверно).`,
    `Термопанели: ${N} шт. · ${fmtInt(est.costPanels)} ₽ (ceil(${S}/0,54)).`,
    `Клей-пена: ${N_foam} балл. (800 мл) · ${fmtInt(est.costFoam)} ₽.`,
    `Затирка: ${N_grout} меш. (25 кг) · ${fmtInt(est.costGrout)} ₽.`,
    `Дюбели: ${fmtInt(N_anchors)} шт. (6×${N}).`,
    'В ответе клиенту используй **только** эти числа для «Итого (ориентир)». Одна строка площади — с **верным** итогом после «=».',
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

module.exports = {
  parseDimensionsFromText,
  extractDimensionsFromHistory,
  computeEstimate,
  estimateFromHistory,
  buildCalcSystemBlock,
  fixWallAreaInReply,
  wallAreaGross,
};

'use strict';

/** Убирает LaTeX и лишнюю разметку — виджет показывает plain text. */
function latexInlineToPlain(inner) {
  return String(inner)
    .replace(/\\,/g, ' ')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\approx/g, '≈')
    .replace(/\\lceil|\\rceil|\\left|\\right/g, '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatBotReply(text) {
  let s = String(text);
  s = s.replace(/\$\$[\s\S]*?\$\$/g, '');
  s = s.replace(/\$([^$\n]+)\$/g, (_m, inner) => latexInlineToPlain(inner));
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/\\?\s*м\^2/gi, 'кв.м');
  s = s.replace(/\bм²\b/g, 'кв.м');
  return s.trim();
}

module.exports = { formatBotReply };

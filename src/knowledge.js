'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'knowledge');

let cached = null;

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return '';
  }
}

function loadKnowledge() {
  if (cached) return cached;

  const llms = readIfExists(path.join(ROOT, 'llms-full.txt'));
  const faq = readIfExists(path.join(ROOT, 'faq-extra.md'));

  cached = {
    llms,
    faq,
    combined: [llms, faq].filter(Boolean).join('\n\n---\n\n'),
  };

  return cached;
}

function buildSystemPrompt() {
  const { combined } = loadKnowledge();

  return [
    'Ты — вежливый консультант сервиса аренды яхт и катеров boat-sochi.ru (Сочи / Сириус / Адлер).',
    'Капитана зовут Олег, телефон +7 917 675 0555.',
    '',
    'Правила:',
    '1. Отвечай по-русски, кратко и по делу (обычно 2–6 предложений).',
    '2. Используй только факты из базы знаний ниже. Не выдумывай цены, суда и условия.',
    '3. Если информации нет — честно скажи и предложи связаться с капитаном.',
    '4. Цены ориентировочные; финальную стоимость подтверждает капитан.',
    '5. Если клиент хочет забронировать — попроси имя, телефон, дату/время, судно и число гостей.',
    '6. Не обещай гарантированную встречу с дельфинами.',
    '7. Говори «капитан», не «менеджер».',
    '',
    '=== БАЗА ЗНАНИЙ ===',
    combined || 'База знаний пуста. Предлагай связаться с капитаном: +7 917 675 0555.',
  ].join('\n');
}

module.exports = {
  loadKnowledge,
  buildSystemPrompt,
};

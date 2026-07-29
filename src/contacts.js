'use strict';

const NATALIA_PHONE = '+7 918 304-40-00';
const NATALIA_PHONE_TEL = '+79183044000';
const OLEG_PHONE = '+7 917 675 0555';
const OLEG_PHONE_TEL = '+79176750555';

/**
 * Маркер кликабельного телефона для виджета (`embed.js` → <a href="tel:...">).
 * В Telegram и прочих plain-text каналах снимать через stripPhoneTokens().
 */
function phoneToken(tel, label) {
  return `{{tel:${tel}|${label}}}`;
}

function nataliaPhoneLink() {
  return phoneToken(NATALIA_PHONE_TEL, NATALIA_PHONE);
}

function olegPhoneLink() {
  return phoneToken(OLEG_PHONE_TEL, OLEG_PHONE);
}

function stripPhoneTokens(text) {
  return String(text).replace(/\{\{tel:\+?\d+\|([^}]+)\}\}/g, '$1');
}

/** Полные контакты — когда бот/сервис недоступен (в столбик). */
const UNAVAILABLE_REPLY = [
  'Сейчас помощник временно недоступен. Свяжитесь с нами:',
  '',
  'Капитан Олег',
  OLEG_PHONE,
  'https://wa.me/79176750555',
  'https://t.me/Oleg_700',
  'https://max.ru/u/f9LHodD0cOLfwfVnOTd4z8W-cQP1Wvx427sjPPALmFsnT4at-1pMe4Y5NF4',
  '',
  'Наталья',
  NATALIA_PHONE,
  'https://wa.me/79183044000',
  'https://t.me/nata_rybiy',
  'https://max.ru/u/f9LHodD0cOI8OH4kIB7PsiV6jWNHRWg_O33iJTe5q_TJs73hHe1YBcSMwKk',
  '',
  'Или оставьте заявку на обратный звонок: https://boat-sochi.ru/#bot',
].join('\n');

const CALLBACK_FORM_URL = 'https://boat-sochi.ru/#bot';

/**
 * Клиент просит, чтобы ему написали / связались письменно —
 * направляем на форму обратной связи (#bot), как при обратном звонке.
 */
const WRITE_TO_CLIENT_RE =
  /напиш(?:и|ите)\s+мне|напишите\s+пожалуйста\s+мне|напишите\s+мне\s+в|напиш(?:и|ите)\s+в\s+(?:whats?app|ватсап|вацап|телеграм|telegram|max|макс)|напишите\s+на\s+(?:мой\s+)?(?:телефон|номер)|свяжитесь\s+со\s+мной|отправьте\s+мне(?:\s+(?:сообщение|смс))?|хочу\s+чтобы\s+мне\s+написали|пусть\s+мне\s+напишут|напишите\s+клиенту/i;

function isWriteToClientIntent(text) {
  return WRITE_TO_CLIENT_RE.test(String(text || ''));
}

/**
 * @param {string} [source]
 */
function buildCallbackFormReply(source) {
  const link = source === 'web' || source === 'widget' ? '#bot' : CALLBACK_FORM_URL;
  return [
    'Хорошо — оставьте, пожалуйста, заявку на обратный звонок на сайте, и мы с вами свяжемся (напишем или перезвоним):',
    link,
  ].join('\n');
}

module.exports = {
  NATALIA_PHONE,
  NATALIA_PHONE_TEL,
  OLEG_PHONE,
  OLEG_PHONE_TEL,
  CALLBACK_FORM_URL,
  phoneToken,
  nataliaPhoneLink,
  olegPhoneLink,
  stripPhoneTokens,
  UNAVAILABLE_REPLY,
  isWriteToClientIntent,
  buildCallbackFormReply,
};

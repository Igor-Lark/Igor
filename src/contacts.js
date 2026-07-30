'use strict';

const { extractPhone } = require('./leads');

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
 * Клиент просит, чтобы ему написали / связались письменно.
 */
const WRITE_TO_CLIENT_RE =
  /напиш(?:и|ите)\s+мне|напишите\s+пожалуйста\s+мне|напишите\s+мне\s+в|напиш(?:и|ите)\s+в\s+(?:whats?app|ватсап|вацап|телеграм|telegram|max|макс)|напишите\s+на\s+(?:мой\s+)?(?:телефон|номер)|свяжитесь\s+со\s+мной|отправьте\s+мне(?:\s+(?:сообщение|смс))?|хочу\s+чтобы\s+мне\s+написали|пусть\s+мне\s+напишут|напишите\s+клиенту/i;

/** Оставил контакт и просит перезвонить / связаться. */
const CONTACT_CALLBACK_RE =
  /перезвон|позвоните|наберите|отзвонитесь|жду\s+(?:звонка|связи|звонок)|свяжитесь|связаться|связаться\s+по\s+телефон|по\s+телефон(?:у|е)|хочу\s+(?:чтобы\s+)?(?:мне\s+)?(?:перезвонили|позвонили|набрали)/i;

function isWriteToClientIntent(text) {
  return WRITE_TO_CLIENT_RE.test(String(text || ''));
}

function hasContactInText(text) {
  const t = String(text || '');
  if (extractPhone(t)) return true;
  if (/[\w.-]+@[\w.-]+\.\w{2,}/.test(t)) return true;
  if (/@[\w_]{3,}/.test(t)) return true;
  if (/t\.me\/|wa\.me\/|max\.ru\/u\//i.test(t)) return true;
  return false;
}

/** Контакт + просьба связаться, или явная просьба «напишите мне». */
function isContactCallbackIntent(text, history) {
  const t = String(text || '');
  if (isWriteToClientIntent(t)) return true;
  const hasContact = hasContactInText(t);
  const histContact =
    Array.isArray(history) &&
    history.some((m) => m && m.role === 'user' && hasContactInText(m.content));
  if ((hasContact || histContact) && CONTACT_CALLBACK_RE.test(t)) return true;
  return false;
}

/**
 * @param {string} [source]
 */
function buildCallbackFormReply(source) {
  const link = source === 'web' || source === 'widget' ? '#bot' : CALLBACK_FORM_URL;
  return [
    'Из этого чата мы не можем принять контакт и связаться с вами — такой возможности нет.',
    'Свяжитесь с нами сами, пожалуйста:',
    '',
    'Наталья',
    NATALIA_PHONE,
    'https://wa.me/79183044000',
    'https://t.me/nata_rybiy',
    'https://max.ru/u/f9LHodD0cOI8OH4kIB7PsiV6jWNHRWg_O33iJTe5q_TJs73hHe1YBcSMwKk',
    '',
    'Капитан Олег',
    OLEG_PHONE,
    'https://wa.me/79176750555',
    'https://t.me/Oleg_700',
    'https://max.ru/u/f9LHodD0cOLfwfVnOTd4z8W-cQP1Wvx427sjPPALmFsnT4at-1pMe4Y5NF4',
    '',
    'Или заполните форму на сайте:',
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
  isContactCallbackIntent,
  hasContactInText,
  buildCallbackFormReply,
};

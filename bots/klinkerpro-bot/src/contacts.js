'use strict';

const MANAGER_PHONE = '+7 (921) 745-77-55';
const MANAGER_PHONE_TEL = '+79217457755';
const SITE_TERMO = 'https://marmara-pro.ru/termo';
const SITE_MAIN = 'https://marmara-pro.ru/main';

function phoneToken(tel, label) {
  return `{{tel:${tel}|${label}}}`;
}

function managerPhoneLink() {
  return phoneToken(MANAGER_PHONE_TEL, MANAGER_PHONE);
}

function replyHasClickablePhone(text) {
  const s = String(text);
  if (/\{\{tel:/.test(s)) return true;
  return /(?:\+7|8)[ \t\-()]*(?:\d[ \t\-()]*){10}/.test(s);
}

function replyMentionsManagerContact(text) {
  return /менеджер|свяжитесь|связаться|перезвон|позвоните|звоните|обратитесь\s+к\s+нам|для\s+(?:более\s+)?точн/i.test(
    String(text)
  );
}

/** Если в ответе зовут к менеджеру, но нет телефона — добавить {{tel:…}} для виджета. */
function ensureManagerPhoneLink(text) {
  if (!text) return text;
  if (replyHasClickablePhone(text)) return text;
  if (!replyMentionsManagerContact(text)) return text;
  return `${String(text).trimEnd()}\n\n${managerPhoneLink()}`;
}

function stripPhoneTokens(text) {
  return String(text).replace(/\{\{tel:\+?\d+\|([^}]+)\}\}/g, '$1');
}

const UNAVAILABLE_REPLY = [
  'Сейчас помощник временно недоступен. Свяжитесь с КлинкерПрофи:',
  '',
  managerPhoneLink(),
  `Сайт: ${SITE_TERMO}`,
  `Контакты: ${SITE_MAIN}#contacts`,
].join('\n');

module.exports = {
  MANAGER_PHONE,
  MANAGER_PHONE_TEL,
  SITE_TERMO,
  SITE_MAIN,
  phoneToken,
  managerPhoneLink,
  ensureManagerPhoneLink,
  replyHasClickablePhone,
  stripPhoneTokens,
  UNAVAILABLE_REPLY,
};

'use strict';

const SITE_TERMO = 'https://marmara-pro.ru/termo';
const SITE_MAIN = 'https://marmara-pro.ru/main';
/** MAX в шапке сайта marmara-pro.ru */
const MAX_MESSENGER_URL =
  'https://max.ru/u/f9LHodD0cOIpC25EaD4tYfNKs2IixN6hR4GPJ7lLCZmLWlK0NXznAW7oYyM';

const DIRECTOR = {
  name: 'Дмитрий',
  role: 'управляющий',
  phone: '+7 (921) 745-77-55',
  tel: '+79217457755',
};

const MANAGER_NADEZHDA = {
  name: 'Надежда',
  role: 'менеджер',
  phone: '+7 (996) 760-23-23',
  tel: '+79967602323',
};

/** @deprecated используйте directorPhoneLink */
const MANAGER_PHONE = DIRECTOR.phone;
const MANAGER_PHONE_TEL = DIRECTOR.tel;

function phoneToken(tel, label) {
  return `{{tel:${tel}|${label}}}`;
}

function directorPhoneLink() {
  return phoneToken(DIRECTOR.tel, DIRECTOR.phone);
}

function managerNadezhdaPhoneLink() {
  return phoneToken(MANAGER_NADEZHDA.tel, MANAGER_NADEZHDA.phone);
}

function managerPhoneLink() {
  return directorPhoneLink();
}

/** MAX в тексте: виджет превращает URL max.ru в кликабельную подпись «MAX». */
function maxMessengerLink() {
  return MAX_MESSENGER_URL;
}

/** Блок контактов для клиента (только Дмитрий + Надежда). */
function buildClientContactsBlock() {
  return [
    `Управляющий ${DIRECTOR.name}: ${directorPhoneLink()}, MAX: ${maxMessengerLink()}`,
    `Менеджер ${MANAGER_NADEZHDA.name}: ${managerNadezhdaPhoneLink()}.`,
  ].join('\n');
}

function replyHasClickablePhone(text) {
  const s = String(text);
  if (/\{\{tel:/.test(s)) return true;
  return /(?:\+7|8)[ \t\-()]*(?:\d[ \t\-()]*){10}/.test(s);
}

function replyMentionsManagerContact(text) {
  return /менеджер|управляющ|свяжитесь|связаться|перезвон|позвоните|звоните|обратитесь\s+к\s+нам|для\s+(?:более\s+)?точн/i.test(
    String(text)
  );
}

/** Если зовут к менеджеру, но нет телефонов — добавить блок контактов. */
function ensureManagerPhoneLink(text) {
  if (!text) return text;
  if (replyHasClickablePhone(text)) return text;
  if (!replyMentionsManagerContact(text)) return text;
  return `${String(text).trimEnd()}\n\n${buildClientContactsBlock()}`;
}

function stripPhoneTokens(text) {
  return String(text).replace(/\{\{tel:\+?\d+\|([^}]+)\}\}/g, '$1');
}

const UNAVAILABLE_REPLY = [
  'Сейчас помощник временно недоступен. Свяжитесь с КлинкерПрофи:',
  '',
  buildClientContactsBlock(),
].join('\n');

module.exports = {
  DIRECTOR,
  MANAGER_NADEZHDA,
  MANAGER_PHONE,
  MANAGER_PHONE_TEL,
  MAX_MESSENGER_URL,
  SITE_TERMO,
  SITE_MAIN,
  phoneToken,
  directorPhoneLink,
  managerNadezhdaPhoneLink,
  managerPhoneLink,
  buildClientContactsBlock,
  ensureManagerPhoneLink,
  replyHasClickablePhone,
  stripPhoneTokens,
  UNAVAILABLE_REPLY,
};

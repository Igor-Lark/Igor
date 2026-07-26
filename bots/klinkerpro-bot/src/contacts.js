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

function stripPhoneTokens(text) {
  return String(text).replace(/\{\{tel:\+?\d+\|([^}]+)\}\}/g, '$1');
}

const UNAVAILABLE_REPLY = [
  'Сейчас помощник временно недоступен. Свяжитесь с КлинкерПрофи:',
  '',
  MANAGER_PHONE,
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
  stripPhoneTokens,
  UNAVAILABLE_REPLY,
};

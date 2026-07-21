'use strict';

/** Полные контакты — когда бот/сервис недоступен (в столбик). */
const UNAVAILABLE_REPLY = [
  'Сейчас помощник временно недоступен. Свяжитесь с нами:',
  '',
  'Капитан Олег',
  '+7 917 675 0555',
  'https://wa.me/79176750555',
  'https://t.me/Oleg_700',
  'https://max.ru/u/f9LHodD0cOLfwfVnOTd4z8W-cQP1Wvx427sjPPALmFsnT4at-1pMe4Y5NF4',
  '',
  'Наталья',
  '+7 918 304-40-00',
  'https://wa.me/79183044000',
  'https://t.me/nata_rybiy',
  'https://max.ru/u/f9LHodD0cOI8OH4kIB7PsiV6jWNHRWg_O33iJTe5q_TJs73hHe1YBcSMwKk',
  '',
  'Или оставьте заявку на обратный звонок: https://boat-sochi.ru/#zakaz',
].join('\n');

module.exports = {
  UNAVAILABLE_REPLY,
};

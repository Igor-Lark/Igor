'use strict';

const config = require('./config');

const PHONE_RE =
  /(?:\+?7|8)[\s\-()]*(?:\d[\s\-()]*){10}|\b\d{3}[\s\-()]?\d{3}[\s\-()]?\d{2}[\s\-()]?\d{2}\b/;

const BOOKING_RE =
  /хочу\s+заброн|заброн(ировать|юй|ьте)|оформить\s+заказ|заказать\s+(катер|яхт|прогул)|записаться|оставить\s+заявк|свяжит(есь|е)|перезвон|забронируй/i;

/**
 * @param {string} text
 */
function extractPhone(text) {
  const m = String(text || '').match(PHONE_RE);
  return m ? m[0].replace(/\s+/g, ' ').trim() : null;
}

/**
 * @param {string} text
 */
function isBookingIntent(text) {
  return BOOKING_RE.test(String(text || ''));
}

/**
 * @param {{ text: string, source?: string, sessionId?: string, username?: string, extra?: object }} opts
 */
function shouldNotifyLead(opts) {
  const text = opts.text || '';
  return Boolean(extractPhone(text) || isBookingIntent(text));
}

/**
 * Отправка заявки менеджеру в Telegram.
 * @param {{ text: string, source?: string, sessionId?: string, username?: string, history?: {role:string,content:string}[], reply?: string }} lead
 */
async function notifyManager(lead) {
  const chatId = config.telegram.managerChatId;
  const token = config.telegram.token;

  if (!token || !chatId) {
    console.warn(
      '[leads] TELEGRAM_BOT_TOKEN / TELEGRAM_MANAGER_CHAT_ID не заданы — заявка не отправлена'
    );
    return { sent: false, reason: 'telegram_not_configured' };
  }

  const phone = extractPhone(lead.text) || 'не указан';
  const source = lead.source || 'unknown';
  const lines = [
    '🌊 Новая заявка — Boat Sochi',
    `Источник: ${source}`,
    lead.username ? `Пользователь: ${lead.username}` : null,
    lead.sessionId ? `Сессия: ${lead.sessionId}` : null,
    `Телефон: ${phone}`,
    '',
    'Сообщение клиента:',
    lead.text,
  ].filter((x) => x !== null);

  if (lead.history?.length) {
    const last = lead.history.slice(-4);
    lines.push('', 'Контекст:');
    for (const m of last) {
      const who = m.role === 'user' ? 'Клиент' : 'Бот';
      lines.push(`${who}: ${String(m.content).slice(0, 200)}`);
    }
  }

  const body = encodeURIComponent(lines.join('\n'));
  const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${encodeURIComponent(
    chatId
  )}&text=${body}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text();
    console.error('[leads] Telegram notify failed:', errText);
    return { sent: false, reason: errText };
  }

  return { sent: true, channel: 'telegram' };
}

module.exports = {
  extractPhone,
  isBookingIntent,
  shouldNotifyLead,
  notifyManager,
};

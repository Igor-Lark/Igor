'use strict';

const config = require('./config');
const { sendMaxMessage } = require('./max');

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
 * Отправка заявки менеджеру в MAX (групповой чат или личка).
 * @param {{ text: string, source?: string, sessionId?: string, username?: string, history?: {role:string,content:string}[], reply?: string }} lead
 */
async function notifyManager(lead) {
  if (!config.hasMaxNotify) {
    console.warn(
      '[leads] MAX_BOT_TOKEN и MAX_CHAT_ID (или MAX_USER_ID) не заданы — заявка не отправлена'
    );
    return { sent: false, reason: 'max_not_configured' };
  }

  const phone = extractPhone(lead.text) || 'не указан';
  const source = lead.source || 'unknown';
  const lines = [
    '🌊 **Новая заявка — Boat Sochi**',
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

  try {
    await sendMaxMessage({
      token: config.max.token,
      chatId: config.max.chatId || undefined,
      userId: config.max.userId || undefined,
      text: lines.join('\n'),
    });
    return { sent: true, channel: 'max' };
  } catch (err) {
    console.error('[leads] MAX notify failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = {
  extractPhone,
  isBookingIntent,
  shouldNotifyLead,
  notifyManager,
};

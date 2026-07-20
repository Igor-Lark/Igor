'use strict';

/**
 * Отправка сообщений в мессенджер MAX (dev.max.ru).
 * Личный диалог — через user_id; группа — через chat_id.
 */

const MAX_API = 'https://platform-api2.max.ru';

/**
 * @param {{ token: string, userId?: string|number, chatId?: string|number, text: string }} opts
 */
async function sendMaxMessage(opts) {
  const token = opts.token;
  if (!token) throw new Error('MAX_BOT_TOKEN не задан');

  const params = new URLSearchParams();
  if (opts.userId) params.set('user_id', String(opts.userId));
  if (opts.chatId) params.set('chat_id', String(opts.chatId));
  if (!opts.userId && !opts.chatId) {
    throw new Error('Укажите MAX_USER_ID или MAX_CHAT_ID');
  }

  const res = await fetch(`${MAX_API}/messages?${params}`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: String(opts.text).slice(0, 4000),
      format: 'markdown',
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`MAX API ${res.status}: ${body.slice(0, 500)}`);
  }

  try {
    return JSON.parse(body);
  } catch {
    return { raw: body };
  }
}

module.exports = { sendMaxMessage, MAX_API };

'use strict';

/**
 * Уведомление менеджеру, если ИИ (YandexGPT/OpenAI) недоступен.
 * С кулдауном, чтобы не спамить при каждой ошибке клиента.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

const STATE_FILE = path.join(__dirname, '..', 'data', 'ai-alert-state.json');
const COOLDOWN_MS = Number(process.env.AI_ALERT_COOLDOWN_MINUTES || 30) * 60 * 1000;

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastAt: 0, lastError: '' };
  }
}

function writeState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('[ai-alert] state save failed:', e.message);
  }
}

function shortErr(err) {
  const msg = String(err && err.message ? err.message : err || 'unknown').slice(0, 400);
  // не тащим возможные ключи из тела ответа
  return msg.replace(/Api-Key\s+\S+/gi, 'Api-Key ***').replace(/Bearer\s+\S+/gi, 'Bearer ***');
}

async function sendManager(text) {
  if (config.hasTelegramNotify) {
    const { telegramFetch } = require('./telegram-net');
    const res = await telegramFetch(`https://api.telegram.org/bot${config.telegram.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.telegram.managerChatId, text }),
    });
    if (!res.ok) {
      console.error('[ai-alert] telegram failed', await res.text());
      return false;
    }
    return true;
  }

  if (config.hasMaxNotify) {
    try {
      const { sendMaxMessage } = require('./max');
      await sendMaxMessage({
        token: config.max.token,
        chatId: config.max.chatId,
        userId: config.max.userId,
        text,
      });
      return true;
    } catch (e) {
      console.error('[ai-alert] max failed', e.message);
      return false;
    }
  }

  console.warn('[ai-alert] нет канала уведомлений (Telegram/MAX)');
  return false;
}

/**
 * @param {Error|string} err
 * @param {{ source?: string, force?: boolean }} [opts]
 * @returns {Promise<boolean>} true если отправили
 */
async function alertAiFailure(err, opts = {}) {
  const now = Date.now();
  const state = readState();
  if (!opts.force && state.lastAt && now - state.lastAt < COOLDOWN_MS) {
    console.warn('[ai-alert] skip (cooldown), last:', new Date(state.lastAt).toISOString());
    return false;
  }

  const detail = shortErr(err);
  const source = opts.source ? `Источник: ${opts.source}\n` : '';
  const text = [
    '⚠️ КлинкерПрофи бот: ИИ не отвечает',
    source.trim(),
    detail,
    '',
    'Проверьте Yandex Cloud (баланс / квота / ключ) и процесс бота на VPS.',
  ]
    .filter(Boolean)
    .join('\n');

  const sent = await sendManager(text);
  if (sent) {
    writeState({ lastAt: now, lastError: detail });
    console.log('[ai-alert] notified manager');
  }
  return sent;
}

module.exports = {
  alertAiFailure,
  shortErr,
  COOLDOWN_MS,
};

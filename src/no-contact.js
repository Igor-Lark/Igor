'use strict';

/**
 * Если клиент пообщался и ушёл без контакта — сообщение менеджеру:
 * «Клиент12 · 21-07 20:04 — клиент общался 4 мин, контакт не оставил»
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { extractPhone } = require('./leads');

const ROOT = path.join(__dirname, '..', 'data', 'no-contact');
const COUNTER_FILE = path.join(ROOT, 'counter.json');
const ACTIVE_FILE = path.join(ROOT, 'active.json');

const IDLE_MS =
  Math.max(2, Number(process.env.NO_CONTACT_IDLE_MINUTES || 10) || 10) * 60 * 1000;

/** @type {Map<string, object>} */
const active = new Map();

function ensure() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function loadCounter() {
  ensure();
  try {
    const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
    return Number(data.next) || 1;
  } catch {
    return 1;
  }
}

function saveCounter(next) {
  ensure();
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ next }, null, 2), 'utf8');
}

function nextClientNumber() {
  const n = loadCounter();
  saveCounter(n + 1);
  return n;
}

function loadActive() {
  ensure();
  try {
    const data = JSON.parse(fs.readFileSync(ACTIVE_FILE, 'utf8'));
    if (data && typeof data === 'object') {
      for (const [id, s] of Object.entries(data)) active.set(id, s);
    }
  } catch {
    // empty
  }
}

function saveActive() {
  ensure();
  const obj = {};
  for (const [id, s] of active.entries()) obj[id] = s;
  fs.writeFileSync(ACTIVE_FILE, JSON.stringify(obj, null, 2), 'utf8');
}

function moscowParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  );
  return {
    dayMonth: `${parts.day}-${parts.month}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min <= 0) return `${sec} сек`;
  if (sec === 0) return `${min} мин`;
  return `${min} мин ${sec} сек`;
}

function sessionKey(sessionId, source) {
  return `${source || 'unknown'}::${String(sessionId || 'unknown').slice(0, 80)}`;
}

/**
 * Обновить активность сессии после реплики клиента.
 * @param {{
 *   sessionId?: string,
 *   source?: string,
 *   username?: string,
 *   userText?: string,
 *   history?: {role:string,content:string}[],
 * }} opts
 */
function touchSession(opts) {
  const id = sessionKey(opts.sessionId, opts.source);
  const now = Date.now();
  const texts = [
    opts.userText || '',
    ...(opts.history || []).map((m) => m.content || ''),
  ].join('\n');
  const phone = extractPhone(texts);
  let s = active.get(id);
  if (!s) {
    s = {
      sessionId: opts.sessionId ? String(opts.sessionId) : null,
      source: opts.source || 'unknown',
      username: opts.username || null,
      startedAt: now,
      lastAt: now,
      userTurns: 0,
      hasContact: Boolean(phone),
      notified: false,
      clientNo: null,
    };
    active.set(id, s);
  }
  s.lastAt = now;
  s.userTurns = (s.userTurns || 0) + 1;
  if (opts.username) s.username = opts.username;
  if (phone) s.hasContact = true;
  saveActive();
  return s;
}

function markContact(sessionId, source) {
  const id = sessionKey(sessionId, source);
  const s = active.get(id);
  if (!s) return;
  s.hasContact = true;
  saveActive();
}

async function sendManager(text) {
  if (config.hasTelegramNotify) {
    const token = config.telegram.token;
    const chatId = config.telegram.managerChatId;
    const { telegramFetch } = require('./telegram-net');
    const res = await telegramFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error('[no-contact] telegram send failed', await res.text());
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
      console.error('[no-contact] max send failed', e.message);
      return false;
    }
  }

  console.warn('[no-contact] нет канала уведомлений (Telegram/MAX)');
  return false;
}

/**
 * Проверить простаивающие сессии без контакта.
 */
async function flushIdleSessions(now = Date.now()) {
  const toNotify = [];
  for (const [id, s] of active.entries()) {
    if (s.notified || s.hasContact) continue;
    if ((s.userTurns || 0) < 1) continue;
    if (now - s.lastAt < IDLE_MS) continue;
    toNotify.push([id, s]);
  }

  for (const [id, s] of toNotify) {
    const clientNo = nextClientNumber();
    s.clientNo = clientNo;
    s.notified = true;
    const when = moscowParts(new Date(s.lastAt || now));
    const duration = formatDuration((s.lastAt || now) - (s.startedAt || now));
    const lines = [
      `Клиент${clientNo} · ${when.dayMonth} ${when.time}`,
      `Продолжительность общения: ${duration}, контакт не оставил`,
      `Источник: ${s.source || 'unknown'}`,
    ];
    if (s.username) lines.push(`Пользователь: ${s.username}`);
    if (s.sessionId) lines.push(`Сессия: ${s.sessionId}`);

    const ok = await sendManager(lines.join('\n'));
    if (!ok) {
      // вернём флаг, чтобы попробовать снова
      s.notified = false;
      s.clientNo = null;
    } else {
      console.log('[no-contact] notified', `Клиент${clientNo}`, id);
    }
    active.delete(id);
  }

  // подчистить старые с контактом / уже уведомлённые
  for (const [id, s] of active.entries()) {
    if (s.hasContact && now - s.lastAt > IDLE_MS) active.delete(id);
    if (s.notified) active.delete(id);
  }
  saveActive();
  return toNotify.length;
}

let started = false;
function startNoContactWatcher() {
  if (started) return;
  started = true;
  loadActive();
  setInterval(() => {
    flushIdleSessions().catch((e) => console.error('[no-contact]', e.message));
  }, 60 * 1000).unref?.();
  console.log(
    `[no-contact] watcher: idle ${Math.round(IDLE_MS / 60000)} мин без контакта → уведомление менеджеру`
  );
}

module.exports = {
  touchSession,
  markContact,
  flushIdleSessions,
  startNoContactWatcher,
  IDLE_MS,
  ROOT,
};

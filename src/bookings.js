'use strict';

/**
 * Черновики броней и напоминания за N часов до выхода.
 * По умолчанию выключено: BOOKING_REMINDERS_ENABLED=0
 */

const fs = require('fs');
const path = require('path');
const { extractPhone } = require('./leads');

const ROOT = path.join(__dirname, '..', 'data', 'bookings');
const STORE = path.join(ROOT, 'bookings.json');

function ensureStore() {
  fs.mkdirSync(ROOT, { recursive: true });
  if (!fs.existsSync(STORE)) {
    fs.writeFileSync(STORE, JSON.stringify({ bookings: [] }, null, 2), 'utf8');
  }
}

function loadAll() {
  ensureStore();
  try {
    const data = JSON.parse(fs.readFileSync(STORE, 'utf8'));
    return Array.isArray(data.bookings) ? data.bookings : [];
  } catch {
    return [];
  }
}

function saveAll(bookings) {
  ensureStore();
  fs.writeFileSync(STORE, JSON.stringify({ bookings }, null, 2), 'utf8');
}

function uid() {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Грубая дата/время из текста клиента (МСК, локальное время сервера = UTC+3 желательно на VPS).
 * @param {string} text
 * @param {Date} [now]
 * @returns {string|null} ISO string or null
 */
function parseStartAt(text, now = new Date()) {
  // \b в JS не работает с кириллицей — границы через (^|\\s|[\\.,!?])
  const t = String(text || '').toLowerCase().replace(/\s+/g, ' ');
  const base = new Date(now);
  const edge = '(?:^|[\\s,.;:!?«»"\'(])';
  const end = '(?=$|[\\s,.;:!?»"\')])';

  let dayOffset = null;
  if (new RegExp(`${edge}сегодня${end}`).test(t)) dayOffset = 0;
  else if (new RegExp(`${edge}завтра${end}`).test(t)) dayOffset = 1;
  else if (new RegExp(`${edge}послезавтра${end}`).test(t)) dayOffset = 2;

  // ДД.ММ или ДД.ММ.ГГГГ
  let day = null;
  let month = null;
  let year = base.getFullYear();
  const dm = t.match(/(?:^|[\s,.;])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=$|[\s,.;!?])/);
  if (dm) {
    day = Number(dm[1]);
    month = Number(dm[2]);
    if (dm[3]) {
      year = Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]);
    }
  }

  // время: 10:00 (двоеточие) или «в 10.00» / «в 10»
  let hours = null;
  let minutes = 0;
  const tm =
    t.match(/(?:^|[\s,.;])(\d{1,2}):(\d{2})(?=$|[\s,.;!?])/) ||
    t.match(/(?:^|[\s,.;])в\s*(\d{1,2})[.\-](\d{2})(?=$|[\s,.;!?])/) ||
    t.match(new RegExp(`${edge}в\\s*(\\d{1,2})${end}`));
  if (tm) {
    hours = Number(tm[1]);
    minutes = tm[2] != null ? Number(tm[2]) : 0;
    if (/вечер/.test(t) && hours < 12) hours += 12;
    if (/утра|утром/.test(t) && hours === 12) hours = 0;
  }

  if (hours == null || hours > 23 || minutes > 59) return null;

  const start = new Date(base);
  if (dayOffset != null) {
    start.setDate(start.getDate() + dayOffset);
  } else if (day != null && month != null) {
    start.setFullYear(year, month - 1, day);
  } else {
    // только время без даты — не создаём бронь с напоминанием
    return null;
  }

  start.setHours(hours, minutes, 0, 0);
  if (Number.isNaN(start.getTime())) return null;
  return start.toISOString();
}

/**
 * @param {{
 *   text: string,
 *   source?: string,
 *   sessionId?: string,
 *   username?: string,
 *   history?: {role:string,content:string}[],
 * }} lead
 */
function upsertBookingFromLead(lead) {
  const text = [lead.text, ...(lead.history || []).map((m) => m.content)].join('\n');
  const phone = extractPhone(text);
  const contact = phone || lead.username || null;
  if (!contact && !lead.sessionId) return null;

  const startAt = parseStartAt(text);
  const telegramChatId =
    lead.source === 'telegram' && lead.sessionId && /^\d+$/.test(String(lead.sessionId))
      ? String(lead.sessionId)
      : null;

  const bookings = loadAll();
  // обновить свежий черновик той же сессии за последний час
  const hourAgo = Date.now() - 60 * 60 * 1000;
  let existing = bookings.find(
    (b) =>
      b.sessionId &&
      lead.sessionId &&
      b.sessionId === String(lead.sessionId) &&
      new Date(b.updatedAt || b.createdAt).getTime() > hourAgo &&
      !b.cancelled
  );

  if (!existing) {
    existing = {
      id: uid(),
      createdAt: new Date().toISOString(),
      reminder3hSentAt: null,
      cancelled: false,
    };
    bookings.push(existing);
  }

  existing.updatedAt = new Date().toISOString();
  existing.source = lead.source || 'unknown';
  existing.sessionId = lead.sessionId ? String(lead.sessionId) : existing.sessionId;
  existing.username = lead.username || existing.username || null;
  existing.phone = phone || existing.phone || null;
  existing.contact = contact || existing.contact || null;
  existing.telegramChatId = telegramChatId || existing.telegramChatId || null;
  existing.rawText = String(lead.text || '').slice(0, 1000);
  if (startAt) existing.startAt = startAt;
  existing.status = existing.startAt ? 'scheduled' : 'draft';

  saveAll(bookings);
  return existing;
}

/**
 * Брони, которым пора слать напоминание за `hoursBefore` часов (± окно).
 * @param {{ hoursBefore?: number, windowMinutes?: number, now?: Date }} opts
 */
function findDueReminders(opts = {}) {
  const hoursBefore = opts.hoursBefore ?? 3;
  const windowMinutes = opts.windowMinutes ?? 20;
  const now = opts.now || new Date();
  const targetMs = hoursBefore * 60 * 60 * 1000;
  const windowMs = windowMinutes * 60 * 1000;

  return loadAll().filter((b) => {
    if (b.cancelled || b.reminder3hSentAt || !b.startAt) return false;
    if (!b.telegramChatId && !b.phone) return false;
    const start = new Date(b.startAt).getTime();
    if (Number.isNaN(start)) return false;
    const delta = start - now.getTime();
    return delta <= targetMs + windowMs && delta >= targetMs - windowMs;
  });
}

function markReminderSent(id) {
  const bookings = loadAll();
  const b = bookings.find((x) => x.id === id);
  if (!b) return null;
  b.reminder3hSentAt = new Date().toISOString();
  saveAll(bookings);
  return b;
}

function remindersEnabled() {
  const v = String(process.env.BOOKING_REMINDERS_ENABLED || '0').trim();
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

function reminderHours() {
  const n = Number(process.env.BOOKING_REMINDER_HOURS || 3);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

module.exports = {
  ROOT,
  STORE,
  loadAll,
  saveAll,
  parseStartAt,
  upsertBookingFromLead,
  findDueReminders,
  markReminderSent,
  remindersEnabled,
  reminderHours,
};

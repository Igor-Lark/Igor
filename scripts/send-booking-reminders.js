'use strict';

/**
 * Напоминания о выходе за N часов (по умолчанию 3).
 *
 * По умолчанию ВЫКЛЮЧЕНО.
 * Включение: BOOKING_REMINDERS_ENABLED=1 в .env
 *
 * Запуск:
 *   npm run remind:bookings
 *   npm run remind:bookings -- --dry-run
 */

require('dotenv').config();

const config = require('../src/config');
const { telegramFetch } = require('../src/telegram-net');
const {
  remindersEnabled,
  reminderHours,
  findDueReminders,
  markReminderSent,
} = require('../src/bookings');

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      timeZone: process.env.TZ || 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function buildText(b) {
  const when = b.startAt ? formatWhen(b.startAt) : 'указанное время';
  return [
    '⏰ Напоминание о прогулке',
    `Начало около: ${when}`,
    'Приходите за 10 минут. Причал Сириус: Парусная 1, линия 1 (от отеля «Легенда» через парковку).',
    'Связь: Наталья +7 918 304-40-00, капитан Олег +7 917 675 0555.',
  ].join('\n');
}

async function sendTelegram(chatId, text) {
  const token = config.telegram.token;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN не задан');
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await telegramFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${body.slice(0, 300)}`);
}

async function main() {
  const dry = process.argv.includes('--dry-run');
  const hours = reminderHours();

  if (!remindersEnabled() && !dry) {
    console.log('[reminders] ВЫКЛЮЧЕНО (BOOKING_REMINDERS_ENABLED≠1). Ничего не отправляем.');
    console.log('[reminders] Для теста: npm run remind:bookings -- --dry-run');
    return;
  }

  if (!remindersEnabled() && dry) {
    console.log('[reminders] dry-run при выключенном флаге — только показ кандидатов');
  }

  const due = findDueReminders({ hoursBefore: hours });
  console.log(`[reminders] due=${due.length} hoursBefore=${hours}`);

  for (const b of due) {
    const text = buildText(b);
    console.log('---', b.id, 'startAt=', b.startAt, 'tg=', b.telegramChatId, 'phone=', b.phone);
    console.log(text);

    if (dry) continue;

    if (b.telegramChatId) {
      await sendTelegram(b.telegramChatId, text);
      markReminderSent(b.id);
      console.log('[reminders] sent telegram', b.telegramChatId);
    } else {
      console.log('[reminders] skip: нет telegramChatId (SMS пока не подключены)');
    }
  }
}

main().catch((err) => {
  console.error('[reminders] ERROR', err.message);
  process.exit(1);
});

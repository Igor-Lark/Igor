'use strict';

/**
 * Напоминания о выходе за N часов (по умолчанию 3).
 *
 * Ветка MAX: отправка клиенту в личку MAX по maxUserId.
 * (Telegram chatId — запасной путь, если есть.)
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
const { sendMaxMessage } = require('../src/max');
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
    'Связь: мадам Наталья +7 918 304-40-00, босс Олег +7 917 675 0555.',
  ].join('\n');
}

async function sendMax(userId, text) {
  const token = config.max.token;
  if (!token) throw new Error('MAX_BOT_TOKEN не задан');
  await sendMaxMessage({
    token,
    userId,
    text,
  });
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
    console.log(
      '---',
      b.id,
      'startAt=',
      b.startAt,
      'maxUserId=',
      b.maxUserId || '-',
      'tg=',
      b.telegramChatId || '-',
      'phone=',
      b.phone || '-'
    );
    console.log(text);

    if (dry) continue;

    if (b.maxUserId) {
      await sendMax(b.maxUserId, text);
      markReminderSent(b.id);
      console.log('[reminders] sent MAX user_id=', b.maxUserId);
    } else {
      console.log(
        '[reminders] skip: нет maxUserId (клиент должен написать боту в MAX — тогда user_id сохранится в брони)'
      );
    }
  }
}

main().catch((err) => {
  console.error('[reminders] ERROR', err.message);
  process.exit(1);
});

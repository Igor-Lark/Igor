'use strict';

/**
 * Узнать user_id клиента в MAX (для личных сообщений / напоминаний).
 *
 * Клиент в приложении MAX обычно свой user_id не видит.
 * Бот получает его из входящего сообщения (sender.user_id).
 *
 * 1. Задайте MAX_BOT_TOKEN в .env
 * 2. Запустите: npm run max:user-id
 * 3. Напишите боту в MAX любое сообщение (лучше из того аккаунта, чей id нужен)
 *
 * Скрипт напечатает user_id. Для напоминаний id сохраняется сам,
 * если клиент пишет боту и оставляет заявку (source=max, sessionId=user_id).
 */

require('dotenv').config();

const { MAX_API } = require('../src/max');

async function main() {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) {
    console.error('Задайте MAX_BOT_TOKEN в .env');
    process.exit(1);
  }

  console.log('Слушаю события MAX (long polling) — ищем user_id...');
  console.log('Напишите боту в личку из MAX.\n');

  let marker = null;
  const seen = new Set();
  const deadline = Date.now() + 3 * 60 * 1000;

  while (Date.now() < deadline) {
    const params = new URLSearchParams({
      limit: '100',
      timeout: '30',
      types: 'message_created,bot_started',
    });
    if (marker != null) params.set('marker', String(marker));

    const res = await fetch(`${MAX_API}/updates?${params}`, {
      headers: { Authorization: token },
    });
    const body = await res.text();
    if (!res.ok) {
      console.error('MAX API error', res.status, body.slice(0, 400));
      process.exit(1);
    }

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      console.error('Неожиданный ответ', body.slice(0, 400));
      process.exit(1);
    }

    marker = data.marker ?? marker;
    const updates = data.updates || [];

    for (const u of updates) {
      const userId =
        u.message?.sender?.user_id ??
        u.user_id ??
        u.message?.from?.user_id ??
        u.callback?.user?.user_id ??
        null;
      const name =
        [u.message?.sender?.first_name, u.message?.sender?.last_name, u.message?.sender?.name]
          .filter(Boolean)
          .join(' ') || u.message?.sender?.username || '';
      const type = u.update_type || '';

      if (userId != null && !seen.has(String(userId))) {
        seen.add(String(userId));
        console.log('────────────────────────');
        console.log(`Найден user_id: ${userId}`);
        if (name) console.log(`Имя: ${name}`);
        console.log(`Событие: ${type}`);
        console.log('Этот id нужен боту, чтобы писать человеку в личку MAX.');
        console.log('Клиенту смотреть его не обязательно — бот запомнит сам при переписке.');
        console.log('────────────────────────\n');
      } else {
        console.log('событие:', type || 'unknown', userId ? `(user_id=${userId})` : '');
      }
    }
  }

  if (!seen.size) {
    console.log('За 3 минуты user_id не поймали.');
    console.log('Проверьте: бот запущен, вы пишете именно этому боту в личку MAX.');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

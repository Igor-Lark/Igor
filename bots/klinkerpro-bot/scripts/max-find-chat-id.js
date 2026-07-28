'use strict';

/**
 * Помощник: узнать chat_id группового чата MAX.
 *
 * 1. Создайте бота и возьмите MAX_BOT_TOKEN
 * 2. Добавьте бота в нужный чат (тот же, где бот Тильды / заявки с сайта)
 * 3. Напишите в чат любое сообщение (или передобавьте бота)
 * 4. Запустите: npm run max:chat-id
 *
 * Скрипт слушает GET /updates и печатает найденные chat_id.
 */

require('dotenv').config();

const { MAX_API } = require('../src/max');

async function main() {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) {
    console.error('Задайте MAX_BOT_TOKEN в .env');
    process.exit(1);
  }

  console.log('Слушаю события MAX (long polling)...');
  console.log('Добавьте бота в чат с заявками Тильды и напишите туда сообщение.\n');

  let marker = null;
  const seen = new Set();
  const deadline = Date.now() + 3 * 60 * 1000; // 3 минуты

  while (Date.now() < deadline) {
    const params = new URLSearchParams({
      limit: '100',
      timeout: '30',
      types: 'message_created,bot_added,bot_started',
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
      const chatId =
        u.chat_id ??
        u.message?.recipient?.chat_id ??
        u.message?.chat_id ??
        null;
      const chatType = u.message?.recipient?.chat_type || u.chat_type || '';
      const title = u.chat_title || u.message?.recipient?.title || '';
      const type = u.update_type || '';

      if (chatId != null && !seen.has(String(chatId))) {
        seen.add(String(chatId));
        console.log('────────────────────────');
        console.log(`Найден chat_id: ${chatId}`);
        if (chatType) console.log(`Тип: ${chatType}`);
        if (title) console.log(`Название: ${title}`);
        console.log(`Событие: ${type}`);
        console.log(`→ пропишите в .env / GitHub Secrets:`);
        console.log(`MAX_CHAT_ID=${chatId}`);
        console.log('────────────────────────\n');
      } else {
        console.log('событие:', type || 'unknown', chatId ? `(chat_id=${chatId})` : '');
      }
    }
  }

  if (!seen.size) {
    console.log('За 3 минуты chat_id не поймали.');
    console.log('Проверьте: бот добавлен в группу, есть право писать, webhook не перекрывает long polling.');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

'use strict';

/**
 * Проверка «жив ли бот».
 *
 *   npm run health:ping
 *   npm run health:ping -- --notify   # в группу менеджеру, только если плохо
 *
 * Проверяет: Telegram getMe + (если задан) HTTP /health
 */

require('dotenv').config();

const config = require('../src/config');

async function tg(method) {
  const token = config.telegram.token;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN не задан');
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`);
  const body = await res.json();
  if (!body.ok) throw new Error(`Telegram ${method}: ${JSON.stringify(body)}`);
  return body.result;
}

async function httpHealth() {
  const base = config.publicUrl || `http://127.0.0.1:${config.port}`;
  if (base.includes('ваш-домен')) {
    // локальная проверка
    const res = await fetch(`http://127.0.0.1:${config.port}/health`);
    if (!res.ok) throw new Error(`health HTTP ${res.status}`);
    return res.json();
  }
  const res = await fetch(`${base}/health`);
  if (!res.ok) throw new Error(`health HTTP ${res.status}`);
  return res.json();
}

async function notify(text) {
  const chatId = config.telegram.managerChatId;
  const token = config.telegram.token;
  if (!chatId || !token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function main() {
  const doNotify = process.argv.includes('--notify');
  const problems = [];

  try {
    const me = await tg('getMe');
    console.log('[health] telegram ok @' + me.username);
  } catch (e) {
    problems.push('Telegram: ' + e.message);
  }

  try {
    const h = await httpHealth();
    console.log('[health] http ok', JSON.stringify(h));
    if (!h.ok) problems.push('HTTP health ok=false');
    if (h.ai === 'none') problems.push('AI не настроен');
  } catch (e) {
    problems.push('HTTP: ' + e.message);
  }

  if (!problems.length) {
    console.log('[health] ALL GOOD');
    return;
  }

  console.error('[health] PROBLEMS:\n- ' + problems.join('\n- '));
  if (doNotify) {
    await notify('⚠️ Бот Boat Sochi: проблемы\n- ' + problems.join('\n- '));
    console.log('[health] notified manager chat');
  }
  process.exit(1);
}

main().catch((e) => {
  console.error('[health] ERROR', e.message);
  process.exit(1);
});

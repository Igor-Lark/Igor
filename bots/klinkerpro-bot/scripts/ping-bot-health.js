'use strict';

/**
 * Проверка «жив ли бот».
 *
 *   npm run health:ping
 *   npm run health:ping -- --notify   # в группу менеджеру, только если плохо
 *   npm run health:ping -- --notify --force-ai-alert  # сразу алерт по ИИ (без кулдауна)
 *
 * Проверяет: Telegram getMe + HTTP /health + короткий пинг YandexGPT/OpenAI
 */

require('dotenv').config();

const config = require('../src/config');
const { telegramFetch } = require('../src/telegram-net');
const { pingAi } = require('../src/ai');
const { alertAiFailure } = require('../src/ai-alert');

async function tg(method) {
  const token = config.telegram.token;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN не задан');
  const res = await telegramFetch(`https://api.telegram.org/bot${token}/${method}`);
  const body = await res.json();
  if (!body.ok) throw new Error(`Telegram ${method}: ${JSON.stringify(body)}`);
  return body.result;
}

async function httpHealth() {
  const base = config.publicUrl || `http://127.0.0.1:${config.port}`;
  if (base.includes('ваш-домен')) {
    const res = await fetch(`http://127.0.0.1:${config.port}/health`);
    if (!res.ok) throw new Error(`health HTTP ${res.status}`);
    return res.json();
  }
  const res = await fetch(`${base}/health`);
  if (!res.ok) throw new Error(`health HTTP ${res.status}`);
  return res.json();
}

async function notify(text) {
  // MAX-ветка: заявки/алерты в MAX
  if (config.hasMaxNotify) {
    const { sendMaxMessage } = require('../src/max');
    await sendMaxMessage({
      token: config.max.token,
      chatId: config.max.chatId || undefined,
      userId: config.max.userId || undefined,
      text,
    });
    return;
  }
  const chatId = config.telegram.managerChatId;
  const token = config.telegram.token;
  if (!chatId || !token) return;
  await telegramFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function main() {
  const doNotify = process.argv.includes('--notify');
  const forceAiAlert = process.argv.includes('--force-ai-alert');
  const skipAi = process.argv.includes('--skip-ai');
  const problems = [];
  let aiError = null;

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

  if (!skipAi) {
    try {
      const ai = await pingAi();
      console.log('[health] ai ok', ai.provider, String(ai.reply).slice(0, 40));
    } catch (e) {
      aiError = e;
      problems.push('AI: ' + e.message);
      console.error('[health] ai FAIL', e.message);
    }
  }

  if (!problems.length) {
    console.log('[health] ALL GOOD');
    return;
  }

  console.error('[health] PROBLEMS:\n- ' + problems.join('\n- '));
  if (doNotify) {
    await notify('⚠️ Бот Boat Sochi: проблемы\n- ' + problems.join('\n- '));
    console.log('[health] notified manager chat');
    if (aiError) {
      await alertAiFailure(aiError, { source: 'health:ping', force: forceAiAlert });
    }
  }
  process.exit(1);
}

main().catch((e) => {
  console.error('[health] ERROR', e.message);
  process.exit(1);
});

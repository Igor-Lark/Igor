'use strict';

const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const { handleChat } = require('./chat');
const { isMapIntent, hasSiriusMapFile, SIRIUS_MAP_FILE, siriusMapCaption } = require('./maps');
const { buildGreeting } = require('./knowledge');
const { touchSession } = require('./no-contact');
const { botRequestOptions, proxyUrl } = require('./telegram-net');

/** @type {Map<number, { role: string, content: string }[]>} */
const sessions = new Map();

function getHistory(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, []);
  return sessions.get(chatId);
}

function pushMessage(chatId, role, content) {
  const hist = getHistory(chatId);
  hist.push({ role, content });
  if (hist.length > 20) hist.splice(0, hist.length - 20);
}

function attachHandlers(bot) {
  async function sendGreeting(chatId) {
    sessions.set(chatId, []);
    await bot.sendMessage(chatId, '👋 ' + buildGreeting());
  }

  // /start, /start@BotName, /start payload
  bot.onText(/\/start(?:@\w+)?(?:\s|$)/i, async (msg) => {
    await sendGreeting(msg.chat.id);
  });

  bot.onText(/\/reset(?:@\w+)?(?:\s|$)/i, async (msg) => {
    sessions.set(msg.chat.id, []);
    await bot.sendMessage(msg.chat.id, 'Диалог очищен. Чем помочь?');
  });

  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();
    const chatId = msg.chat.id;

    // Кнопка «Запустить» в Telegram = /start; также ловим текст «запустить бота»
    if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text) || /^(запустить(\s+бота)?|старт|start)$/i.test(text)) {
      // /start уже обработан onText; текстовые варианты — здесь
      if (!text.startsWith('/')) await sendGreeting(chatId);
      return;
    }

    if (text.startsWith('/')) return;

    const username = [msg.from?.username && `@${msg.from.username}`, msg.from?.first_name]
      .filter(Boolean)
      .join(' ');

    pushMessage(chatId, 'user', text);

    try {
      await bot.sendChatAction(chatId, 'typing');

      // Схема прохода к причалу — картинкой
      if (isMapIntent(text) && hasSiriusMapFile()) {
        touchSession({
          sessionId: String(chatId),
          source: 'telegram',
          username,
          userText: text,
          history: getHistory(chatId),
        });
        await bot.sendPhoto(chatId, SIRIUS_MAP_FILE, { caption: siriusMapCaption() });
        pushMessage(chatId, 'assistant', siriusMapCaption());
        return;
      }

      const { reply } = await handleChat({
        messages: getHistory(chatId),
        source: 'telegram',
        sessionId: String(chatId),
        username,
      });
      pushMessage(chatId, 'assistant', reply);
      await bot.sendMessage(chatId, reply);
    } catch (err) {
      console.error('[telegram] chat error:', err.message);
      try {
        await bot.sendMessage(
          chatId,
          'Сейчас не могу ответить. Босс Олег: +7 917 675 0555, мадам Наталья: +7 918 304-40-00'
        );
      } catch (sendErr) {
        console.error('[telegram] fallback send failed:', sendErr.message);
      }
    }
  });
}

/**
 * Polling иногда рвётся (сеть / IPv6 / блокировка VPS→Telegram).
 * Перезапускаем ТОЛЬКО по polling_error, с экспоненциальной паузой —
 * иначе при ETIMEDOUT лог забивается и бот «молчит» в круге рестартов.
 * @param {TelegramBot} bot
 */
function watchPolling(bot) {
  let restarting = false;
  let backoffMs = 3000;
  const BACKOFF_MAX = 5 * 60 * 1000;

  async function restartPolling(reason) {
    if (restarting) return;
    restarting = true;
    const wait = backoffMs;
    backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX);
    console.error(`[telegram] restarting polling in ${Math.round(wait / 1000)}s:`, reason);
    try {
      await bot.stopPolling({ cancel: true }).catch(() => {});
      await new Promise((r) => setTimeout(r, wait));
      await bot.startPolling({ restart: true });
      console.log('[telegram] polling restarted OK');
      backoffMs = 3000;
    } catch (e) {
      console.error('[telegram] polling restart failed:', e.message);
    } finally {
      restarting = false;
    }
  }

  bot.on('polling_error', (err) => {
    const msg = err && err.message ? err.message : String(err);
    // 409 = второй экземпляр бота; просто логируем
    if (/409/.test(msg)) {
      console.error(
        '[telegram] polling_error 409 (другой getUpdates). Проверьте, что бот запущен в одном месте.'
      );
      return;
    }
    if (/ETIMEDOUT|ECONNREFUSED|ENETUNREACH|AggregateError|fetch failed/i.test(msg) && !proxyUrl()) {
      console.error(
        '[telegram] нет связи с api.telegram.org. На VPS: curl -4 -m 10 https://api.telegram.org/ — если таймаут, нужен TELEGRAM_PROXY или другой хостинг.'
      );
    }
    restartPolling(msg);
  });
}

/**
 * @param {import('express').Express} app
 */
function startTelegram(app) {
  if (!config.hasTelegram) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN не задан — бот отключён');
    return null;
  }

  // webhook только если PUBLIC_URL боевой И не форсирован polling
  const forcePolling = ['1', 'true', 'yes', 'polling'].includes(
    String(process.env.TELEGRAM_MODE || '').trim().toLowerCase()
  );
  const useWebhook =
    !forcePolling &&
    Boolean(config.publicUrl && !config.publicUrl.includes('ваш-домен'));

  /** @type {TelegramBot} */
  let bot;

  const botOpts = {
    request: botRequestOptions(),
  };

  // Если задан прокси — только polling: webhook Telegram шлёт НА VPS напрямую, прокси не поможет.
  if (useWebhook && proxyUrl()) {
    console.warn(
      '[telegram] TELEGRAM_PROXY задан → принудительно polling (webhook Telegram→VPS прокси не обходит)'
    );
  }

  if (useWebhook && !proxyUrl()) {
    bot = new TelegramBot(config.telegram.token, { webHook: false, ...botOpts });
    const hookPath = `/telegram/webhook/${config.telegram.token}`;
    const hookUrl = `${config.publicUrl}${hookPath}`;

    app.post(hookPath, (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });

    bot
      .setWebHook(hookUrl)
      .then(() => console.log('[telegram] webhook:', hookUrl))
      .catch((err) => console.error('[telegram] setWebHook failed:', err.message));
  } else {
    bot = new TelegramBot(config.telegram.token, { polling: true, ...botOpts });
    console.log('[telegram] polling mode' + (proxyUrl() ? ' (via proxy)' : ''));
    watchPolling(bot);
  }

  if (hasSiriusMapFile()) {
    console.log('[telegram] схема причала Сириус: найдена, будет отправляться по запросу');
  } else {
    console.log('[telegram] схема причала Сириус: файл пока отсутствует (public/maps/sirius-line1.jpg)');
  }

  attachHandlers(bot);

  return bot;
}

module.exports = { startTelegram };

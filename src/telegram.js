'use strict';

const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const { handleChat } = require('./chat');
const { isMapIntent, hasSiriusMapFile, SIRIUS_MAP_FILE, siriusMapCaption } = require('./maps');

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

/**
 * @param {import('express').Express} app
 */
function startTelegram(app) {
  if (!config.hasTelegram) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN не задан — бот отключён');
    return null;
  }

  const useWebhook = Boolean(config.publicUrl && !config.publicUrl.includes('ваш-домен'));
  /** @type {TelegramBot} */
  let bot;

  if (useWebhook) {
    bot = new TelegramBot(config.telegram.token, { webHook: false });
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
    bot = new TelegramBot(config.telegram.token, { polling: true });
    console.log('[telegram] polling mode');
  }

  if (hasSiriusMapFile()) {
    console.log('[telegram] схема причала Сириус: найдена, будет отправляться по запросу');
  } else {
    console.log('[telegram] схема причала Сириус: файл пока отсутствует (public/maps/sirius-line1.jpg)');
  }

  bot.onText(/\/start/, async (msg) => {
    sessions.set(msg.chat.id, []);
    await bot.sendMessage(
      msg.chat.id,
      '👋 Здравствуйте! Помогу с катером или яхтой.\n\nКапитан часто в море — связь может быть слабой. Звоните Наталье: +7 918 304-40-00 или оставьте контакт — свяжемся.'
    );
  });

  bot.onText(/\/reset/, async (msg) => {
    sessions.set(msg.chat.id, []);
    await bot.sendMessage(msg.chat.id, 'Диалог очищен. Чем помочь?');
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const username = [msg.from?.username && `@${msg.from.username}`, msg.from?.first_name]
      .filter(Boolean)
      .join(' ');

    pushMessage(chatId, 'user', msg.text);

    try {
      await bot.sendChatAction(chatId, 'typing');

      // Схема прохода к причалу — картинкой, если файл есть
      if (isMapIntent(msg.text) && hasSiriusMapFile()) {
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
      await bot.sendMessage(
        chatId,
        'Сейчас не могу ответить. Капитан Олег: +7 917 675 0555, Наталья: +7 918 304-40-00'
      );
    }
  });

  return bot;
}

module.exports = { startTelegram };

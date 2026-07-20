'use strict';

require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 3000,
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  botName: process.env.BOT_NAME || 'Boat Sochi',

  yandex: {
    apiKey: process.env.YANDEX_API_KEY || '',
    folderId: process.env.YANDEX_FOLDER_ID || '',
    model: process.env.YANDEX_MODEL || 'yandexgpt-lite',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
  },

  // Заявки менеджеру + Avito → тот же групповой чат MAX (где бот Тильды)
  max: {
    token: process.env.MAX_BOT_TOKEN || '',
    chatId: process.env.MAX_CHAT_ID || '',
    userId: process.env.MAX_USER_ID || '',
  },
};

config.hasYandex = Boolean(config.yandex.apiKey && config.yandex.folderId);
config.hasOpenAI = Boolean(config.openai.apiKey);
config.hasTelegram = Boolean(config.telegram.token);
config.hasMaxNotify = Boolean(
  config.max.token && (config.max.chatId || config.max.userId)
);

module.exports = config;

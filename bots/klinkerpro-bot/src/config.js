'use strict';

require('dotenv').config();

function envEnabled(name, defaultOn) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultOn;
  return !/^(0|false|no|off)$/i.test(String(raw).trim());
}

const config = {
  port: Number(process.env.PORT) || 3001,
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  botName: process.env.BOT_NAME || 'КлинкерПрофи',
  /** PNG/WebP маскота над кнопкой виджета (desktop), отдаётся в /api/widget-config */
  widgetMascotUrl: (process.env.WIDGET_MASCOT_URL || '').trim(),

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
    managerChatId: process.env.TELEGRAM_MANAGER_CHAT_ID || '',
  },

  max: {
    token: process.env.MAX_BOT_TOKEN || '',
    chatId: process.env.MAX_CHAT_ID || '',
    userId: process.env.MAX_USER_ID || '',
  },
};

config.hasYandex = Boolean(config.yandex.apiKey && config.yandex.folderId);
config.hasOpenAI = Boolean(config.openai.apiKey);
config.hasTelegram = Boolean(config.telegram.token);
config.hasTelegramNotify = Boolean(config.telegram.token && config.telegram.managerChatId);
/** Заявки и служебные уведомления в MAX (по умолчанию выключено). */
config.maxNotifyEnabled = envEnabled('MAX_NOTIFY_ENABLED', false);
config.hasMaxCredentials = Boolean(
  config.max.token && (config.max.chatId || config.max.userId)
);
config.hasMaxNotify = config.maxNotifyEnabled && config.hasMaxCredentials;

module.exports = config;

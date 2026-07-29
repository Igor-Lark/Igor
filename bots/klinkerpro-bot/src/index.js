'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { handleChat } = require('./chat');
const { loadKnowledge, buildGreeting, buildWidgetGreeting } = require('./knowledge');
const { startNoContactWatcher } = require('./no-contact');
const { FACADE_CALC_VERSION } = require('./facade-calc');
const { getCalcPricing } = require('./pricing');
const { UNAVAILABLE_REPLY } = require('./contacts');

const app = express();

app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  const kb = loadKnowledge();
  const prices = getCalcPricing();
  res.json({
    ok: true,
    bot: config.botName,
    ai: config.hasYandex ? 'yandex' : config.hasOpenAI ? 'openai' : 'none',
    telegram: config.hasTelegram,
    maxNotify: config.hasMaxNotify,
    maxNotifyEnabled: config.maxNotifyEnabled,
    knowledgeChars: kb.combined.length,
    facadeCalcVersion: FACADE_CALC_VERSION,
    pricingSource: prices.source,
    pricingSyncedAt: prices.syncedAt,
    panelPriceRub: prices.panelPriceRub,
    publicUrl: config.publicUrl || null,
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, sessionId } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Ожидается messages: [{role, content}]' });
    }

    const result = await handleChat({
      messages,
      source: 'web',
      sessionId: sessionId ? String(sessionId).slice(0, 64) : undefined,
    });

    res.json({
      reply: result.reply,
      provider: result.provider,
      leadNotified: Boolean(result.lead?.sent),
    });
  } catch (err) {
    console.error('[api/chat]', err.message);
    res.status(500).json({
      error: 'Не удалось получить ответ',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
      reply: UNAVAILABLE_REPLY,
    });
  }
});

app.get('/api/widget-config', (_req, res) => {
  res.json({
    name: config.botName,
    greeting: buildWidgetGreeting(),
    unavailableReply: UNAVAILABLE_REPLY,
    mascotUrl: config.widgetMascotUrl || null,
  });
});

if (config.hasTelegram) {
  const { startTelegram } = require('./telegram');
  startTelegram(app);
} else {
  console.log('[server] Telegram-бот отключён (нет TELEGRAM_BOT_TOKEN)');
}

startNoContactWatcher();

app.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port}`);
  console.log(`[server] AI: ${config.hasYandex ? 'YandexGPT' : config.hasOpenAI ? 'OpenAI' : 'НЕ НАСТРОЕН'}`);
  console.log(`[server] MAX заявки: ${config.hasMaxNotify ? 'да' : 'нет'}`);
  console.log(`[server] embed: ${config.publicUrl || 'http://localhost:' + config.port}/embed.js`);
});

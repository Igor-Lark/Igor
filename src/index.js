'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { handleChat } = require('./chat');
const { startTelegram } = require('./telegram');
const { loadKnowledge, buildGreeting } = require('./knowledge');
const { startNoContactWatcher } = require('./no-contact');
const { UNAVAILABLE_REPLY } = require('./contacts');
const { prefetchWeather } = require('./weather');

const app = express();

app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  const kb = loadKnowledge();
  res.json({
    ok: true,
    bot: config.botName,
    ai: config.hasYandex ? 'yandex' : config.hasOpenAI ? 'openai' : 'none',
    telegram: config.hasTelegram,
    telegramNotify: config.hasTelegramNotify,
    maxNotify: config.hasMaxNotify,
    knowledgeChars: kb.combined.length,
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
      mapUrl: result.mapUrl || undefined,
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

// Конфиг для виджета (имя бота, публичный URL)
app.get('/api/widget-config', async (_req, res) => {
  // Предзагрузка погоды при открытии виджета (кэш 1 час)
  let weatherWarning = null;
  try {
    const w = await prefetchWeather('sirius');
    weatherWarning = w.worseningWarning || null;
  } catch (err) {
    console.error('[widget-config] weather prefetch:', err.message);
  }
  res.json({
    name: config.botName,
    greeting: buildGreeting(),
    unavailableReply: UNAVAILABLE_REPLY,
    weatherWarning,
  });
});

/** Предзагрузка погоды при открытии окна чата (не чаще 1 раза в час). */
app.get('/api/weather/prefetch', async (_req, res) => {
  try {
    const w = await prefetchWeather('sirius');
    res.json({
      ok: true,
      fromCache: Boolean(w.fromCache),
      airC: w.airC,
      waterC: w.waterC,
      condition: w.condition,
      placeLabel: w.placeLabel,
      worseningWarning: w.worseningWarning || null,
    });
  } catch (err) {
    console.error('[weather/prefetch]', err.message);
    res.status(502).json({ ok: false, error: 'weather unavailable' });
  }
});

startTelegram(app);
startNoContactWatcher();

app.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port}`);
  console.log(`[server] AI: ${config.hasYandex ? 'YandexGPT' : config.hasOpenAI ? 'OpenAI' : 'НЕ НАСТРОЕН'}`);
  console.log(`[server] embed: ${config.publicUrl || 'http://localhost:' + config.port}/embed.js`);
});

'use strict';

const { buildSystemPrompt } = require('./knowledge');
const { completeChat } = require('./ai');
const { shouldNotifyLead, notifyManager } = require('./leads');
const { logChatTurn } = require('./chat-log');
const { upsertBookingFromLead } = require('./bookings');
const {
  isMapIntent,
  isAleksumDirectionsIntent,
  hasSiriusMapFile,
  siriusMapCaption,
  siriusMapPublicUrl,
  aleksumDirectionsReply,
} = require('./maps');
const { touchSession, markContact } = require('./no-contact');
const { extractPhone } = require('./leads');
const { alertAiFailure } = require('./ai-alert');
const {
  isWeatherIntent,
  buildWeatherReply,
  weatherPromptBlock,
  buildSwimWaterNote,
} = require('./weather');
const { isCapacityIntent, buildCapacityReply, capacityPromptBlock } = require('./fleet');
const { isWriteToClientIntent, isContactCallbackIntent, buildCallbackFormReply } = require('./contacts');
const { isSeaRouteIntent, buildSeaRouteReply } = require('./routes');

/**
 * @param {{
 *   messages: { role: string, content: string }[],
 *   source?: string,
 *   sessionId?: string,
 *   username?: string,
 * }} input
 */
async function handleChat(input) {
  const history = Array.isArray(input.messages) ? input.messages : [];
  const cleaned = history
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content).trim().slice(0, 4000),
    }))
    .slice(-12);

  if (!cleaned.length) {
    return { reply: 'Напишите ваш вопрос — с радостью помогу с прогулкой на катере или яхте.', lead: null };
  }

  const lastUser = [...cleaned].reverse().find((m) => m.role === 'user');

  if (lastUser) {
    touchSession({
      sessionId: input.sessionId,
      source: input.source || 'web',
      username: input.username,
      userText: lastUser.content,
      history: cleaned,
    });
  }

  // «Как пройти к Алексуму» — Морпорт Сочи, без схемы Сириуса
  if (lastUser && isAleksumDirectionsIntent(lastUser.content)) {
    const reply = aleksumDirectionsReply();
    logChatTurn({
      sessionId: input.sessionId,
      source: input.source || 'web',
      username: input.username,
      userText: lastUser.content,
      reply,
      provider: 'map',
      leadSent: false,
      history: cleaned,
    });
    return { reply, provider: 'map', lead: null };
  }

  // Маршрут прогулки по морю (не «как пройти» к причалу)
  if (lastUser && isSeaRouteIntent(lastUser.content)) {
    const reply = buildSeaRouteReply();
    logChatTurn({
      sessionId: input.sessionId,
      source: input.source || 'web',
      username: input.username,
      userText: lastUser.content,
      reply,
      provider: 'route',
      leadSent: false,
      history: cleaned,
    });
    return { reply, provider: 'route', lead: null };
  }

  // «Как пройти / как вас найти» — схема Имеретинского порта (Сириус)
  if (lastUser && isMapIntent(lastUser.content) && hasSiriusMapFile()) {
    const reply = siriusMapCaption();
    const mapUrl = siriusMapPublicUrl() || '/maps/sirius-line1.jpg';
    logChatTurn({
      sessionId: input.sessionId,
      source: input.source || 'web',
      username: input.username,
      userText: lastUser.content,
      reply,
      provider: 'map',
      leadSent: false,
      history: cleaned,
    });
    return { reply, provider: 'map', lead: null, mapUrl };
  }

  // Погода — Open-Meteo (воздух + вода)
  if (lastUser && isWeatherIntent(lastUser.content)) {
    const reply = await buildWeatherReply(lastUser.content);
    if (reply) {
      logChatTurn({
        sessionId: input.sessionId,
        source: input.source || 'web',
        username: input.username,
        userText: lastUser.content,
        reply,
        provider: 'weather',
        leadSent: false,
        history: cleaned,
      });
      return { reply, provider: 'weather', lead: null };
    }
  }

  // Вместимость «на N человек» — только суда с max ≥ N (без LLM-ошибок)
  if (lastUser && isCapacityIntent(lastUser.content)) {
    const reply = buildCapacityReply(lastUser.content);
    if (reply) {
      logChatTurn({
        sessionId: input.sessionId,
        source: input.source || 'web',
        username: input.username,
        userText: lastUser.content,
        reply,
        provider: 'fleet',
        leadSent: false,
        history: cleaned,
      });
      return { reply, provider: 'fleet', lead: null };
    }
  }

  // Контакт + «свяжитесь» / «напишите мне» — нет обратной связи из чата
  if (lastUser && isContactCallbackIntent(lastUser.content)) {
    const reply = buildCallbackFormReply(input.source || 'web');
    logChatTurn({
      sessionId: input.sessionId,
      source: input.source || 'web',
      username: input.username,
      userText: lastUser.content,
      reply,
      provider: 'callback-form',
      leadSent: false,
      history: cleaned,
    });
    return { reply, provider: 'callback-form', lead: null };
  }

  let system = buildSystemPrompt();
  try {
    const wx = await weatherPromptBlock(lastUser ? lastUser.content : '');
    if (wx) system = `${system}\n\n=== ПОГОДА СЕЙЧАС ===\n${wx}`;
  } catch {
    // ignore
  }
  try {
    const cap = capacityPromptBlock(lastUser ? lastUser.content : '');
    if (cap) system = `${system}\n\n=== ФИЛЬТР ПО ВМЕСТИМОСТИ ===\n${cap}`;
  } catch {
    // ignore
  }

  let reply;
  let provider;
  try {
    const out = await completeChat([{ role: 'system', content: system }, ...cleaned]);
    reply = out.reply;
    provider = out.provider;
  } catch (err) {
    console.error('[chat] AI failed:', err.message);
    alertAiFailure(err, { source: input.source || 'web' }).catch(() => {});
    throw err;
  }

  // Купание: один раз за диалог — t° воды «в открытом море»
  if (lastUser) {
    const swimNote = await buildSwimWaterNote(lastUser.content, cleaned);
    if (swimNote) {
      reply = `${reply}\n\n${swimNote}`;
    }
  }

  let lead = null;
  if (lastUser && shouldNotifyLead({ text: lastUser.content })) {
    const leadPayload = {
      text: lastUser.content,
      source: input.source || 'web',
      sessionId: input.sessionId,
      username: input.username,
      history: cleaned,
      reply,
    };
    lead = await notifyManager(leadPayload);
    // Черновик брони (для будущих напоминаний). Отправка напоминаний — отдельно, пока выкл.
    try {
      upsertBookingFromLead(leadPayload);
    } catch (err) {
      console.error('[bookings] upsert failed', err.message);
    }
    if (
      extractPhone(leadPayload.text) ||
      extractPhone((leadPayload.history || []).map((m) => m.content).join('\n'))
    ) {
      markContact(input.sessionId, input.source || 'web');
    }
  }

  // Все диалоги — на диск (даже без заявки)
  logChatTurn({
    sessionId: input.sessionId,
    source: input.source || 'web',
    username: input.username,
    userText: lastUser ? lastUser.content : '',
    reply,
    provider,
    leadSent: Boolean(lead?.sent),
    history: cleaned,
  });

  return { reply, provider, lead };
}

module.exports = { handleChat };

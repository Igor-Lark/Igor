'use strict';

const { buildSystemPrompt } = require('./knowledge');
const { completeChat } = require('./ai');
const { shouldNotifyLead, notifyManager } = require('./leads');
const { logChatTurn } = require('./chat-log');
const { upsertBookingFromLead } = require('./bookings');
const { isMapIntent, hasSiriusMapFile, siriusMapCaption, siriusMapPublicUrl } = require('./maps');
const { touchSession, markContact } = require('./no-contact');
const { extractPhone } = require('./leads');

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

  // «Как пройти / как вас найти» — сразу схема (без ИИ)
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

  const system = buildSystemPrompt();

  const { reply, provider } = await completeChat([{ role: 'system', content: system }, ...cleaned]);

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
    if (extractPhone(leadPayload.text) || extractPhone((leadPayload.history || []).map((m) => m.content).join('\n'))) {
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

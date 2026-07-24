'use strict';

const { buildSystemPrompt } = require('./knowledge');
const { completeChat } = require('./ai');
const { shouldNotifyLead, notifyManager, extractPhone } = require('./leads');
const { logChatTurn } = require('./chat-log');
const { touchSession, markContact } = require('./no-contact');
const { alertAiFailure } = require('./ai-alert');

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
    return {
      reply: 'Напишите вопрос про термопанели, монтаж или доставку — постараюсь помочь.',
      lead: null,
    };
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

  const system = buildSystemPrompt();

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
    if (
      extractPhone(leadPayload.text) ||
      extractPhone((leadPayload.history || []).map((m) => m.content).join('\n'))
    ) {
      markContact(input.sessionId, input.source || 'web');
    }
  }

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

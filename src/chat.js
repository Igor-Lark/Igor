'use strict';

const { buildSystemPrompt } = require('./knowledge');
const { completeChat } = require('./ai');
const { shouldNotifyLead, notifyManager } = require('./leads');

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
  const system = buildSystemPrompt();

  const { reply, provider } = await completeChat([{ role: 'system', content: system }, ...cleaned]);

  let lead = null;
  if (lastUser && shouldNotifyLead({ text: lastUser.content })) {
    lead = await notifyManager({
      text: lastUser.content,
      source: input.source || 'web',
      sessionId: input.sessionId,
      username: input.username,
      history: cleaned,
      reply,
    });
  }

  return { reply, provider, lead };
}

module.exports = { handleChat };

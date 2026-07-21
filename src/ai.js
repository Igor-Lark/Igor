'use strict';

const config = require('./config');

async function completeYandex(messages, options = {}) {
  const { apiKey, folderId, model } = config.yandex;
  const modelUri = `gpt://${folderId}/${model}`;
  const maxTokens = options.maxTokens != null ? options.maxTokens : 800;

  const yandexMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
    text: m.content,
  }));

  const res = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Api-Key ${apiKey}`,
      'x-folder-id': folderId,
    },
    body: JSON.stringify({
      modelUri,
      completionOptions: {
        stream: false,
        temperature: 0.3,
        maxTokens,
      },
      messages: yandexMessages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YandexGPT ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.result?.alternatives?.[0]?.message?.text;
  if (!text) throw new Error('YandexGPT: пустой ответ');
  return text.trim();
}

async function completeOpenAI(messages, options = {}) {
  const { apiKey, model } = config.openai;
  const max_tokens = options.maxTokens != null ? options.maxTokens : 800;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI: пустой ответ');
  return text.trim();
}

/**
 * Короткий пинг ИИ (для health-check).
 * @returns {Promise<{ provider: string, reply: string }>}
 */
async function pingAi() {
  const messages = [{ role: 'user', content: 'Ответь одним словом: ок' }];
  if (config.hasYandex) {
    const reply = await completeYandex(messages, { maxTokens: 10 });
    return { provider: 'yandex', reply };
  }
  if (config.hasOpenAI) {
    const reply = await completeOpenAI(messages, { maxTokens: 10 });
    return { provider: 'openai', reply };
  }
  throw new Error('Не настроен ни YandexGPT, ни OpenAI');
}

/**
 * @param {{ role: string, content: string }[]} messages
 * @returns {Promise<{ reply: string, provider: string }>}
 */
async function completeChat(messages) {
  if (config.hasYandex) {
    const reply = await completeYandex(messages);
    return { reply, provider: 'yandex' };
  }
  if (config.hasOpenAI) {
    const reply = await completeOpenAI(messages);
    return { reply, provider: 'openai' };
  }
  throw new Error('Не настроен ни YandexGPT, ни OpenAI. Заполните .env');
}

module.exports = {
  completeChat,
  completeYandex,
  completeOpenAI,
  pingAi,
};

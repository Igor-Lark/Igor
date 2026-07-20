'use strict';

const config = require('./config');

async function completeYandex(messages) {
  const { apiKey, folderId, model } = config.yandex;
  const modelUri = `gpt://${folderId}/${model}`;

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
        maxTokens: 800,
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

async function completeOpenAI(messages) {
  const { apiKey, model } = config.openai;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 800,
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
};

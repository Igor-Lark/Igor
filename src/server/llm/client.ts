import { externalLimiter } from "../limits";

export class LlmNotConfiguredError extends Error {
  readonly code = "LLM_NOT_CONFIGURED";

  constructor(message: string) {
    super(message);
    this.name = "LlmNotConfiguredError";
  }
}

export type LlmImage = { mime: string; base64: string };

export type LlmRequest = {
  system: string;
  user: string;
  json?: boolean;
  image?: LlmImage;
  signal?: AbortSignal;
};

export type LlmClient = {
  configured: () => boolean;
  visionConfigured: () => boolean;
  complete: (request: LlmRequest) => Promise<string>;
};

export function llmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function visionConfigured(): boolean {
  return llmConfigured() && Boolean(process.env.OPENAI_VISION_MODEL?.trim());
}

const RULES = `Ты помощник внутренней контент-фабрики сайта boat-sochi.ru.
Пиши по-русски.
Не выдумывай цены, даты, расписание, характеристики, гарантии, статистику, URL и источники.
Используй только переданные материалы. Если данных не хватает, прямо напиши об этом.
Наблюдения пользователя не называй независимыми фактами.
Гипотезы называй гипотезами.
Не обещай рост CTR, заявок или продаж.
Не предлагай публиковать материал на сайт или в рекламный кабинет: человек переносит его сам.`;

export function systemRules(extra?: string): string {
  return extra ? `${RULES}\n${extra}` : RULES;
}

export function parseModelJson<T>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(trimmed) as T;
}

async function completeOnce(request: LlmRequest): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new LlmNotConfiguredError("LLM не настроена: в окружении нет OPENAI_API_KEY.");
  if (request.image && !process.env.OPENAI_VISION_MODEL?.trim()) {
    throw new LlmNotConfiguredError("Разбор изображений не настроен: в окружении нет OPENAI_VISION_MODEL.");
  }
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = request.image
    ? process.env.OPENAI_VISION_MODEL!.trim()
    : process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const userContent = request.image
    ? [
        { type: "text", text: request.user },
        { type: "image_url", image_url: { url: `data:${request.image.mime};base64,${request.image.base64}` } },
      ]
    : request.user;
  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: userContent },
    ],
  };
  if (request.json) body.response_format = { type: "json_object" };
  const timeout = AbortSignal.timeout(Number(process.env.BCF_LLM_TIMEOUT_MS || 60000));
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 429 || response.status >= 500) {
    const error = new Error(`LLM временно недоступна (HTTP ${response.status}).`);
    (error as Error & { retryable?: boolean }).retryable = true;
    throw error;
  }
  if (!response.ok) {
    const text = (await response.text()).slice(0, 300);
    throw new Error(`LLM вернула ошибку HTTP ${response.status}: ${text}`);
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("LLM вернула пустой ответ.");
  return content;
}

export async function completeText(request: LlmRequest): Promise<string> {
  return externalLimiter.use(async () => {
    let last: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await completeOnce(request);
      } catch (error) {
        last = error;
        const retryable = Boolean((error as { retryable?: boolean }).retryable);
        if (!retryable || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw last instanceof Error ? last : new Error("LLM не ответила.");
  });
}

export const defaultLlm: LlmClient = {
  configured: llmConfigured,
  visionConfigured,
  complete: completeText,
};

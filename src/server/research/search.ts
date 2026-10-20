import { externalLimiter } from "../limits";

export type SearchHit = { title: string; url: string; snippet: string };

export class SearchNotConfiguredError extends Error {
  readonly code = "SEARCH_NOT_CONFIGURED";

  constructor() {
    super("Веб-поиск не настроен: в окружении нет TAVILY_API_KEY. Можно указать URL источников вручную.");
    this.name = "SearchNotConfiguredError";
  }
}

export type SearchClient = {
  configured: () => boolean;
  search: (query: string, limit?: number) => Promise<SearchHit[]>;
};

export function searchConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY?.trim());
}

export async function searchWeb(query: string, limit = 5): Promise<SearchHit[]> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) throw new SearchNotConfiguredError();
  return externalLimiter.use(async () => {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: limit,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Поиск вернул HTTP ${response.status}.`);
    const data = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    return (data.results || [])
      .filter((item) => item.url && item.title)
      .map((item) => ({
        title: item.title || item.url || "Без названия",
        url: item.url || "",
        snippet: item.content || "",
      }));
  });
}

export const defaultSearch: SearchClient = {
  configured: searchConfigured,
  search: searchWeb,
};

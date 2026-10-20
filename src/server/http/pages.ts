import { externalLimiter } from "../limits";
import { extractHtml, type ExtractedPage } from "./extract";
import { fetchGuarded, type PerformRequest } from "./fetch-guarded";
import type { ResolveHost } from "./ssrf";

export type FetchedDocument = ExtractedPage & {
  httpStatus: number;
  finalUrl: string;
  html: string;
};

async function fetchDocument(
  url: string,
  siteOnly: boolean,
  signal?: AbortSignal,
  resolveHost?: ResolveHost,
  perform?: PerformRequest,
): Promise<FetchedDocument> {
  return externalLimiter.use(async () => {
    const response = await fetchGuarded(url, { siteOnly, signal, resolveHost, perform });
    const html = response.body.toString("utf8");
    const extracted = extractHtml(html, response.finalUrl);
    if (response.status >= 400) {
      extracted.incomplete = true;
      extracted.warnings.push(`Страница ответила HTTP ${response.status}. Текст ошибки не считается содержимым страницы.`);
    }
    return { ...extracted, httpStatus: response.status, finalUrl: response.finalUrl, html };
  });
}

export function fetchSitePage(
  url: string,
  signal?: AbortSignal,
  deps?: { resolveHost?: ResolveHost; perform?: PerformRequest },
): Promise<FetchedDocument> {
  return fetchDocument(url, true, signal, deps?.resolveHost, deps?.perform);
}

export function fetchExternalPage(
  url: string,
  signal?: AbortSignal,
  deps?: { resolveHost?: ResolveHost; perform?: PerformRequest },
): Promise<FetchedDocument> {
  return fetchDocument(url, false, signal, deps?.resolveHost, deps?.perform);
}

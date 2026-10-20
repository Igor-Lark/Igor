import http from "http";
import https from "https";
import { authorizeUrl, type ResolveHost, UrlPolicyError } from "./ssrf";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 1_500_000;

export type GuardedResponse = {
  status: number;
  finalUrl: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

export type PerformRequest = (
  url: URL,
  address: { address: string; family: number },
  signal: AbortSignal,
) => Promise<GuardedResponse>;

export async function fetchGuarded(
  rawUrl: string,
  options: {
    siteOnly: boolean;
    signal?: AbortSignal;
    resolveHost?: ResolveHost;
    perform?: PerformRequest;
  },
): Promise<GuardedResponse> {
  let current = rawUrl;
  const seen = new Set<string>();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (seen.has(current)) throw new UrlPolicyError("Циклическое перенаправление.");
    seen.add(current);
    const { url, address } = await authorizeUrl(current, {
      siteOnly: options.siteOnly,
      resolveHost: options.resolveHost,
    });
    const signal = options.signal ?? AbortSignal.timeout(Number(process.env.BCF_FETCH_TIMEOUT_MS || 15000));
    const response = options.perform
      ? await options.perform(url, address, signal)
      : await requestPinned(url, address, signal);
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { ...response, finalUrl: url.toString() };
    }
    const location = response.headers.location;
    if (!location || Array.isArray(location)) {
      throw new UrlPolicyError("Перенаправление без адреса.");
    }
    current = new URL(location, url).toString();
  }
  throw new UrlPolicyError("Слишком много перенаправлений.");
}

export function pinnedLookup(pinned: { address: string; family: number }) {
  return (_hostname: string, options: { all?: boolean }, callback: (err: NodeJS.ErrnoException | null, address: string | Array<{ address: string; family: number }>, family?: number) => void) => {
    if (options?.all) {
      callback(null, [{ address: pinned.address, family: pinned.family }]);
      return;
    }
    callback(null, pinned.address, pinned.family);
  };
}

function requestPinned(
  target: URL,
  pinned: { address: string; family: number },
  signal: AbortSignal,
): Promise<GuardedResponse> {
  const timeoutMs = Number(process.env.BCF_FETCH_TIMEOUT_MS || 15000);
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Запрос отменён."));
      return;
    }
    const lib = target.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: "GET",
        headers: {
          "User-Agent": "BoatContentFactory/0.1 (local research tool)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ru,en;q=0.5",
        },
        lookup: pinnedLookup(pinned) as NonNullable<https.RequestOptions["lookup"]>,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy(new Error("Ответ страницы слишком большой."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            finalUrl: target.toString(),
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    const onAbort = () => req.destroy(new Error("Запрос отменён."));
    signal.addEventListener("abort", onAbort, { once: true });
    req.on("timeout", () => req.destroy(new Error("Тайм-аут при получении страницы.")));
    req.on("error", (error) => {
      signal.removeEventListener("abort", onAbort);
      reject(error);
    });
    req.end();
  });
}

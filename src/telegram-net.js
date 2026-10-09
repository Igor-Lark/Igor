'use strict';

/**
 * Сеть до Telegram API: IPv4 + опциональный прокси.
 * На части VPS (reg.ru и др.) прямой доступ к api.telegram.org:443 таймаутится.
 *
 * TELEGRAM_PROXY / HTTPS_PROXY / HTTP_PROXY:
 *   http://user:pass@host:port
 *   socks5://user:pass@host:port
 */

function proxyUrl() {
  return (
    String(process.env.TELEGRAM_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '').trim() ||
    ''
  );
}

/** @returns {import('http').Agent | undefined} */
function createProxyAgent() {
  const url = proxyUrl();
  if (!url) return undefined;
  if (/^socks/i.test(url)) {
    const { SocksProxyAgent } = require('socks-proxy-agent');
    return new SocksProxyAgent(url);
  }
  const { HttpsProxyAgent } = require('https-proxy-agent');
  return new HttpsProxyAgent(url);
}

/**
 * Опции `request` для node-telegram-bot-api.
 * @returns {{ agentOptions: { family: number }, agent?: import('http').Agent, proxy?: string }}
 */
function botRequestOptions() {
  const opts = {
    // На VPS Telegram часто ломается на IPv6
    agentOptions: { family: 4 },
  };
  const url = proxyUrl();
  if (!url) return opts;

  const agent = createProxyAgent();
  if (agent) {
    opts.agent = agent;
    console.log('[telegram] proxy:', url.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@'));
  } else if (/^https?:\/\//i.test(url)) {
    // запасной путь для request-библиотеки
    opts.proxy = url;
    console.log('[telegram] proxy (request):', url.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@'));
  }
  return opts;
}

/**
 * fetch к Telegram (и прочему) через тот же прокси / IPv4.
 * @param {string | URL} url
 * @param {RequestInit & { dispatcher?: unknown }} [init]
 */
async function telegramFetch(url, init = {}) {
  const agent = createProxyAgent();
  if (!agent) {
    return fetch(url, init);
  }

  // Node fetch (undici) не принимает http.Agent напрямую — делаем через https + agent
  const { URL } = require('url');
  const https = require('https');
  const http = require('http');
  const target = new URL(String(url));
  const isHttps = target.protocol === 'https:';
  const lib = isHttps ? https : http;
  const method = (init.method || 'GET').toUpperCase();
  const headers = { ...(init.headers || {}) };

  let body = init.body;
  if (body && typeof body !== 'string' && !Buffer.isBuffer(body)) {
    body = String(body);
  }

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: target.pathname + target.search,
        method,
        headers,
        agent,
        family: 4,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage || '',
            headers: res.headers,
            async text() {
              return buf.toString('utf8');
            },
            async json() {
              return JSON.parse(buf.toString('utf8'));
            },
          });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = {
  proxyUrl,
  createProxyAgent,
  botRequestOptions,
  telegramFetch,
};

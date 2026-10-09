'use strict';

/**
 * Диагностика связи VPS → Telegram API.
 *
 *   node scripts/check-telegram-net.js
 *
 * На сервере без прокси часто: connect ETIMEDOUT 149.154.167.x:443
 * Тогда нужен TELEGRAM_PROXY или другой VPS / тикет в поддержку хостинга.
 */

require('dotenv').config();

const dns = require('dns').promises;
const net = require('net');
const { proxyUrl, telegramFetch } = require('../src/telegram-net');

async function tcpCheck(host, port, family) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, family, timeout: 8000 });
    const done = (ok, detail) => {
      try {
        socket.destroy();
      } catch (_) {
        /* ignore */
      }
      resolve({ ok, detail });
    };
    socket.on('connect', () => done(true, 'connected'));
    socket.on('timeout', () => done(false, 'timeout'));
    socket.on('error', (e) => done(false, e.message));
  });
}

async function main() {
  console.log('=== check Telegram network ===');
  const proxy = proxyUrl();
  console.log('proxy:', proxy ? proxy.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@') : '(none)');

  let ipv4 = [];
  try {
    const r = await dns.lookup('api.telegram.org', { all: true, family: 4 });
    ipv4 = r.map((x) => x.address);
    console.log('DNS A:', ipv4.join(', ') || '(empty)');
  } catch (e) {
    console.error('DNS A failed:', e.message);
  }

  for (const ip of ipv4.slice(0, 2)) {
    const t = await tcpCheck(ip, 443, 4);
    console.log(`TCP ${ip}:443 →`, t.ok ? 'OK' : t.detail);
  }

  try {
    const res = await telegramFetch('https://api.telegram.org/', { method: 'GET' });
    console.log('HTTPS api.telegram.org →', res.status, res.ok || res.status === 302 ? 'reachable' : '');
  } catch (e) {
    console.error('HTTPS api.telegram.org FAILED:', e.message);
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    try {
      const res = await telegramFetch(`https://api.telegram.org/bot${token}/getMe`);
      const body = await res.json();
      if (body.ok) console.log('getMe OK @' + body.result.username);
      else console.error('getMe bad:', JSON.stringify(body));
    } catch (e) {
      console.error('getMe FAILED:', e.message);
    }
  } else {
    console.log('TELEGRAM_BOT_TOKEN не задан — getMe пропущен');
  }

  console.log('');
  console.log('Если TCP/HTTPS FAILED без прокси — это блок хостинга, не баг бота.');
  console.log('Варианты: TELEGRAM_PROXY=... в .env | тикет в reg.ru | другой VPS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

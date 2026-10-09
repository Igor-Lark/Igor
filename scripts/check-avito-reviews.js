'use strict';

/**
 * Ежедневная проверка новых отзывов Avito → уведомление в MAX.
 *
 * Запуск:
 *   npm run check:avito
 *   npm run check:avito -- --notify-always
 *
 * Нужны в .env:
 *   AVITO_ITEM_URL
 *   MAX_BOT_TOKEN
 *   MAX_CHAT_ID   ← групповой чат с ботом Тильды (заявки с сайта)
 *   (или MAX_USER_ID — если писать в личку)
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { fetchAvitoItemReviews } = require('../src/avito-reviews');
const { sendMaxMessage } = require('../src/max');

const STATE_PATH = path.join(__dirname, '..', 'data', 'avito-reviews-state.json');

const DEFAULT_URL =
  'https://m.avito.ru/sochi/predlozheniya_uslug/arenda_yahty_s_kapitanom_7252469249';

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { knownIds: [], lastCheck: null, lastSnapshot: null };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function formatReview(r) {
  const stars = '★'.repeat(Number(r.score) || 0) || '—';
  const text = (r.text || '').slice(0, 400);
  return [
    `• **${r.author}** · ${stars} · ${r.rated || 'дата ?'}`,
    text ? `  ${text}` : '  _(без текста)_',
  ].join('\n');
}

function buildMessage({ snapshot, newReviews, isBaseline, always }) {
  const lines = [];
  lines.push('🚤 **Avito · отзывы**');
  lines.push(snapshot.title || 'Объявление');
  if (snapshot.sellerName) lines.push(`Продавец: ${snapshot.sellerName}`);
  if (snapshot.rating?.itemCaption) {
    lines.push(`Оценка объявления: ${snapshot.rating.itemScore} · ${snapshot.rating.itemCaption}`);
  }
  if (snapshot.rating?.sellerText) {
    lines.push(`Оценка продавца: ${snapshot.rating.sellerScore} · ${snapshot.rating.sellerText}`);
  }
  lines.push('');

  if (isBaseline) {
    lines.push('Мониторинг запущен. База зафиксирована.');
    lines.push(`В превью сейчас: **${snapshot.reviews.length}** свежих отзывов.`);
    if (snapshot.reviews[0]) {
      lines.push('');
      lines.push('Самый новый:');
      lines.push(formatReview(snapshot.reviews[0]));
    }
  } else if (newReviews.length) {
    lines.push(`🆕 **Новых отзывов: ${newReviews.length}**`);
    lines.push('');
    for (const r of newReviews) lines.push(formatReview(r));
  } else if (always) {
    lines.push('Проверка за сутки: **новых отзывов нет**.');
    if (snapshot.reviews[0]) {
      lines.push('');
      lines.push('Последний известный:');
      lines.push(formatReview(snapshot.reviews[0]));
    }
  } else {
    return null;
  }

  lines.push('');
  lines.push(`[Открыть объявление](${snapshot.sourceUrl})`);
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const notifyAlways =
    args.includes('--notify-always') || process.env.AVITO_NOTIFY_ALWAYS === '1';
  const dryRun = args.includes('--dry-run');

  const url = process.env.AVITO_ITEM_URL || DEFAULT_URL;
  const token = process.env.MAX_BOT_TOKEN || '';
  const userId = process.env.MAX_USER_ID || '';
  const chatId = process.env.MAX_CHAT_ID || '';

  console.log('[avito] fetch', url);
  const snapshot = await fetchAvitoItemReviews(url);
  console.log(
    `[avito] ok item=${snapshot.itemId} reviews_preview=${snapshot.reviews.length} seller=${snapshot.sellerName}`
  );

  const state = loadState();
  const known = new Set(state.knownIds || []);
  const isBaseline = known.size === 0;

  const newReviews = snapshot.reviews.filter((r) => !known.has(r.id));
  // newest first already; keep that order
  for (const r of snapshot.reviews) known.add(r.id);

  const nextState = {
    knownIds: [...known],
    lastCheck: snapshot.fetchedAt,
    lastSnapshot: {
      itemId: snapshot.itemId,
      title: snapshot.title,
      rating: snapshot.rating,
      preview: snapshot.reviews.map((r) => ({
        id: r.id,
        author: r.author,
        score: r.score,
        rated: r.rated,
      })),
    },
  };
  saveState(nextState);

  const text = buildMessage({
    snapshot,
    newReviews,
    isBaseline,
    always: notifyAlways,
  });

  if (!text) {
    console.log('[avito] новых отзывов нет — уведомление не отправляем');
    return;
  }

  console.log('[avito] message preview:\n' + text);

  if (dryRun) {
    console.log('[avito] --dry-run: MAX не вызываем');
    return;
  }

  if (!token) {
    console.warn('[avito] MAX_BOT_TOKEN пуст — сообщение не отправлено (состояние сохранено)');
    process.exitCode = 2;
    return;
  }
  if (!chatId && !userId) {
    console.warn('[avito] Нужен MAX_CHAT_ID (чат с ботом Тильды) или MAX_USER_ID');
    process.exitCode = 2;
    return;
  }

  // Приоритет — групповой чат (заявки Тильды)
  await sendMaxMessage({
    token,
    chatId: chatId || undefined,
    userId: chatId ? undefined : userId,
    text,
  });
  console.log(chatId ? `[avito] отправлено в MAX chat_id=${chatId}` : `[avito] отправлено в MAX user_id=${userId}`);
}

main().catch((err) => {
  console.error('[avito] ERROR', err.message);
  // при ошибке тоже пытаемся сообщить в MAX
  const token = process.env.MAX_BOT_TOKEN;
  const userId = process.env.MAX_USER_ID;
  const chatId = process.env.MAX_CHAT_ID;
  if (token && (userId || chatId)) {
    sendMaxMessage({
      token,
      userId,
      chatId,
      text: `⚠️ Avito-монитор: ошибка проверки\n\`${err.message}\``,
    }).catch((e) => console.error('[avito] MAX notify failed', e.message));
  }
  process.exitCode = 1;
});

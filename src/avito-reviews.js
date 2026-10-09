'use strict';

/**
 * Загрузка отзывов с карточки объявления Avito (публичная HTML-страница).
 * Берём превью свежих отзывов из __initialData__ — они идут от новых к старым.
 */

const DEFAULT_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function candidateUrls(url) {
  const clean = String(url).split('#')[0];
  const itemId = extractItemId(clean);
  const list = [clean];
  if (clean.includes('m.avito.ru')) {
    list.push(clean.replace('://m.avito.ru/', '://www.avito.ru/'));
  } else if (clean.includes('www.avito.ru')) {
    list.push(clean.replace('://www.avito.ru/', '://m.avito.ru/'));
  }
  if (itemId) {
    list.push(`https://m.avito.ru/item/${itemId}`);
  }
  return [...new Set(list)];
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ru-RU,ru;q=0.9',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
  });
  const html = await res.text();
  return { status: res.status, html };
}

function parseReviewsFromHtml(html, url) {
  if (/Доступ ограничен|проверка безопасности|проблема с IP/i.test(html)) {
    throw new Error('Avito заблокировал запрос (антибот / IP). Повторите позже или смените IP.');
  }

  const m = html.match(/__initialData__\s*=\s*"((?:\\.|[^"\\])*)"/);
  if (!m) throw new Error('Не найден __initialData__ на странице Avito');

  const decoded = JSON.parse(`"${m[1]}"`);
  const data = JSON.parse(decoded);
  const item = data?.item?.item;
  if (!item) throw new Error('В данных Avito нет объекта item');

  const entries = item.itemReviews?.main?.entries || [];
  const reviews = [];

  for (const entry of entries) {
    if (entry?.type !== 'reviewSeller' || !entry.value) continue;
    const v = entry.value;
    const text = (v.textSections || [])
      .map((s) => s.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();

    reviews.push({
      id: String(v.id),
      author: v.title || 'Без имени',
      score: v.score,
      rated: v.rated || '',
      status: v.status || '',
      text,
      itemTitle: v.itemTitle || item.title || '',
    });
  }

  return {
    itemId: String(item.id || extractItemId(url) || ''),
    title: item.title || '',
    sellerName: item.seller?.name || item.seller?.title || '',
    rating: {
      itemScore: item.itemReviews?.header?.scoreText || null,
      itemCaption: item.itemReviews?.header?.caption || null,
      sellerScore: item.seller?.rating?.scoreFloat ?? item.seller?.rating?.score ?? null,
      sellerText: item.seller?.rating?.text || null,
    },
    reviews,
    fetchedAt: new Date().toISOString(),
    sourceUrl: url.split('#')[0],
  };
}

/**
 * @param {string} url
 * @returns {Promise<{ itemId: string, title: string, sellerName: string, rating: object, reviews: object[], fetchedAt: string }>}
 */
async function fetchAvitoItemReviews(url) {
  const urls = candidateUrls(url);
  const errors = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(2000 * attempt);
    for (const u of urls) {
      try {
        const { status, html } = await fetchHtml(u);
        if (status === 429 || status === 403) {
          errors.push(`${u} → HTTP ${status}`);
          await sleep(3000);
          continue;
        }
        if (status >= 400) {
          errors.push(`${u} → HTTP ${status}`);
          continue;
        }
        return parseReviewsFromHtml(html, u);
      } catch (err) {
        errors.push(`${u} → ${err.message}`);
      }
    }
  }

  throw new Error(`Не удалось получить отзывы Avito. ${errors.slice(-5).join('; ')}`);
}

function extractItemId(url) {
  const m = String(url).match(/_(\d+)(?:\?|#|$)/);
  return m ? m[1] : null;
}

module.exports = {
  fetchAvitoItemReviews,
  extractItemId,
};

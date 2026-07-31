# Цены бота KlinkerPro

**Единственный источник** для продукции КлинкерПрофи — каталог на [marmara-pro.ru/termo](https://marmara-pro.ru/termo) (карточки Tilda Store).

## Обновление

Из каталога бота:

```bash
cd bots/klinkerpro-bot
npm run prices:sync
```

Скрипт:

1. Загружает карточки через Tilda API (`storepartuid=840610530462`).
2. Пишет `data/pricing-from-site.json` (расчёт на сервере и метаданные).
3. Обновляет цифры и списки в `knowledge/site-termo-catalog.md`.

После изменения цен на сайте — **commit** обновлённых `data/pricing-from-site.json` и `site-termo-catalog.md`, затем деплой.

На VPS `deploy-knowledge.sh` вызывает `npm run prices:sync` перед перезапуском pm2 (если есть сеть).

## Где используются цены

| Место | Назначение |
|--------|------------|
| `data/pricing-from-site.json` | Server-calc (`facade-calc.js`), `/health` |
| `knowledge/site-termo-catalog.md` | Промпт ИИ (блок «КАТАЛОГ И ЦЕНЫ С САЙТА») |
| `src/knowledge.js` | Подсказки в system prompt (читает JSON) |

Клей-пена и затирка в JSON **не** подтягиваются из того же API-каталога (там только термопанели и плитка); при появлении карточек на сайте — расширить `sync-prices-from-site.js` или обновить поля в JSON вручную по карточкам /termo.

## Проверка

```bash
curl -s http://127.0.0.1:3001/health | jq '.panelPriceRub, .pricingSyncedAt'
bash scripts/verify-facade-calc.sh
```

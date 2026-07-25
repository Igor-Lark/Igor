# КлинкерПрофi Bot

ИИ-консультант по фасадным термопанелям для [marmara-pro.ru/termo](https://marmara-pro.ru/termo): **виджет на сайте (Tilda)** + **заявки менеджеру в MAX**. Основан на проекте boat-sochi-bot (ветка `cursor/boat-sochi-max-5814`).

| Канал | Назначение |
|--------|------------|
| Сайт | `embed.js` → `POST /api/chat` |
| MAX | Заявки (по умолчанию **выключены**, `MAX_NOTIFY_ENABLED=true` — когда включите) |
| Telegram | **Не обязателен** (включите `TELEGRAM_BOT_TOKEN`, если нужен чат в TG) |

**Прод:** `https://klinker.webtaxi2.ru` · порт на VPS **`3001`** (boat обычно `3000`).

**Подробный запуск на VPS:** [DEPLOY.md](DEPLOY.md)

## База знаний

- `knowledge/faq.md` — FAQ по термопанелям (копия из `agents/termopaneli/faq.md` в репозитории).
- При обновлении FAQ синхронизируйте оба файла или перегенерируйте копию.

## Быстрый старт

```bash
cd bots/klinkerpro-bot
cp .env.example .env
# YANDEX_API_KEY, YANDEX_FOLDER_ID; MAX_NOTIFY_ENABLED=false (заявки в MAX позже)
npm install
npm start
```

Проверка: `curl -s http://127.0.0.1:3001/health | jq`

### MAX (заявки)

1. [dev.max.ru](https://dev.max.ru) → бот → `MAX_BOT_TOKEN`
2. Добавьте бота в чат заявок (как для boat / Tilda)
3. `npm run max:chat-id` → напишите в чат → `MAX_CHAT_ID` в `.env`

### YandexGPT

Как у boat: Folder ID + API-ключ сервисного аккаунта (`ai.languageModels.user`).

## VPS (рядом с boat)

1. Клон репозитория, каталог `bots/klinkerpro-bot`
2. `.env` с `PORT=3001`, `PUBLIC_URL=https://klinker.webtaxi2.ru`
3. systemd unit (пример):

```ini
[Unit]
Description=KlinkerPro bot
After=network.target

[Service]
WorkingDirectory=/path/to/igor/bots/klinkerpro-bot
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

4. Nginx (фрагмент — по аналогии с boat.webtaxi2.ru):

```nginx
server {
    server_name klinker.webtaxi2.ru;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

5. `certbot --nginx -d klinker.webtaxi2.ru`

## Tilda (marmara-pro.ru)

**Настройки сайта → HTML перед `</body>`:**

```html
<script src="https://klinker.webtaxi2.ru/embed.js"></script>
```

На странице `/termo` можно якорь `#bot` для ссылок «оставить заявку».

## API

`POST /api/chat` — `{ "messages": [{ "role": "user", "content": "..." }], "sessionId": "..." }`

## Связь с boat-sochi

| boat-sochi-max | klinkerpro-bot |
|----------------|----------------|
| `knowledge/llms-full.txt` | `knowledge/faq.md` |
| Заявки MAX | Заявки MAX |
| `boat.webtaxi2.ru:3000` | `klinker.webtaxi2.ru:3001` |

Общие правки движка (ai.js, max.js) при необходимости переносите вручную из ветки boat.

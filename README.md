# Boat Sochi Bot

ИИ-бот для [boat-sochi.ru](https://boat-sochi.ru): **чат на сайте (Tilda)**. Ответы через **YandexGPT** (или OpenAI), база знаний в `knowledge/`.

> **Deploy:** ветка `cursor/boat-contact-route-5814` (Beget / VPS).  
> **MAX и Telegram не используем** — токены в `.env` пустые.  
> С VPS в Git: [docs/VPS-TO-GITHUB.md](docs/VPS-TO-GITHUB.md).

## Что внутри

| Компонент | Назначение |
|-----------|------------|
| Node.js API | `POST /api/chat` — ответы через YandexGPT или OpenAI |
| Виджет | Кнопка на сайте Tilda (`/embed.js`) |
| Погода | Open-Meteo: воздух + вода (Сириус / Сочи) |
| База знаний | `knowledge/llms-full.txt`, `faq-extra.md`, `delfin-progulki`, `group-fishing`, `fishing-season-sochi` |

## Быстрый старт

### 1. YandexGPT

1. [console.cloud.yandex.ru](https://console.cloud.yandex.ru) → каталог → **Folder ID**
2. Сервисный аккаунт + роль `ai.languageModels.user` → **API-ключ**

### 2. Настройка

```bash
cp .env.example .env
# YANDEX_API_KEY, YANDEX_FOLDER_ID, PUBLIC_URL (HTTPS)
npm install
npm start
```

Проверка: http://localhost:3000/health

### 3. Виджет на Tilda

**Настройки сайта → HTML перед `</body>`:**

```html
<script src="https://boat.webtaxi2.ru/embed.js"></script>
```

(URL замените на свой после деплоя на Beget.)

## API

### `POST /api/chat`

```json
{
  "messages": [{ "role": "user", "content": "Сколько стоит яхта Сириус?" }],
  "sessionId": "optional"
}
```

## Деплой (Beget / VPS)

```bash
cd /var/www/boat-sochi-bot
git fetch origin cursor/boat-contact-route-5814
git checkout cursor/boat-contact-route-5814
git pull origin cursor/boat-contact-route-5814
npm install
pm2 restart boat-sochi
curl -s https://boat.webtaxi2.ru/health
```

## KlinkerPro

Отдельный бот: ветка `cursor/termopaneli-bot-bfbc`, путь `bots/klinkerpro-bot/` (в этом репозитории на другой ветке).

## Прочее в коде

Скрипты `max:*`, `check:telegram`, `check:avito` и модули MAX/Telegram остаются в репозитории, но **без токенов не активны**. Для Beget их настраивать не нужно.

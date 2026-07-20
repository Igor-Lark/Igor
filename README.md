# Boat Sochi Bot

ИИ-бот для [boat-sochi.ru](https://boat-sochi.ru/): чат на сайте (Tilda) + опционально Telegram. Ответы через **YandexGPT** (или OpenAI), база знаний с сайта, заявки менеджеру в **MAX**.

## Что внутри

| Компонент | Назначение |
|-----------|------------|
| Node.js API | `POST /api/chat` — ответы через YandexGPT или OpenAI |
| Виджет | Кнопка 💬 на сайте Tilda (`/embed.js`) |
| Telegram-бот | Опционально: тот же ИИ в Telegram |
| База знаний | `knowledge/llms-full.txt` + `knowledge/faq-extra.md` |
| Заявки | При «хочу забронировать» / телефоне → уведомление в **MAX** (тот же чат, что у Тильды) |

## Быстрый старт (4 шага)

### 1. YandexGPT

1. [console.cloud.yandex.ru](https://console.cloud.yandex.ru) → каталог → **Folder ID**
2. Сервисный аккаунт + роль `ai.languageModels.user` → **API-ключ**

*(Альтернатива: заполните `OPENAI_API_KEY`, если Yandex не используете.)*

### 2. MAX (заявки менеджеру)

1. Создайте бота MAX → `MAX_BOT_TOKEN`
2. Добавьте бота в **тот же групповой чат**, куда Тильда шлёт заявки с сайта
3. Узнайте id чата: `npm run max:chat-id` → `MAX_CHAT_ID`

*(Telegram для чата с клиентами — по желанию: `TELEGRAM_BOT_TOKEN`.)*

### 3. Настройка

```bash
cp .env.example .env
# заполните YANDEX_API_KEY, YANDEX_FOLDER_ID,
# MAX_BOT_TOKEN, MAX_CHAT_ID

npm install
npm start
```

Проверка: http://localhost:3000/health

### 4. Сервер с HTTPS

Нужен VPS или Railway/Render. В `.env`:

```env
PUBLIC_URL=https://bot.ваш-домен.ru
```

При заданном `PUBLIC_URL` и токене Telegram переключается на webhook. Без него — polling (удобно для локальной разработки).

#### Виджет на Tilda

**Настройки сайта → HTML перед `</body>`:**

```html
<script src="https://bot.ваш-домен.ru/embed.js"></script>
```

## API

### `POST /api/chat`

```json
{
  "messages": [
    { "role": "user", "content": "Сколько стоит катер Сириус?" }
  ],
  "sessionId": "optional"
}
```

Ответ:

```json
{
  "reply": "Катер «Сириус» — 8 000 ₽/час...",
  "provider": "yandex",
  "leadNotified": false
}
```

### `GET /health`

Статус сервиса, выбранный AI-провайдер, размер базы знаний.

## База знаний

- `knowledge/llms-full.txt` — флот, цены, контакты, правила (по данным сайта)
- `knowledge/faq-extra.md` — расширенные ответы FAQ

После правок перезапустите процесс (`npm start`).

## Стоимость (ориентир)

| Статья | ~₽/мес |
|--------|--------|
| VPS (Timeweb) | 300–500 |
| YandexGPT Lite | 200–400 (при ~1000 диалогов) |
| **Итого** | **~700 ₽** |

Дешевле типичных SaaS-виджетов вроде Jivo AI.

## Что нужно для финального запуска

1. **Yandex Cloud** — API-ключ и Folder ID  
2. **VPS или хостинг** — куда выложить бота  
3. **Домен для бота** — например `bot.boat-sochi.ru`  
4. **MAX** — токен бота и Chat ID группового чата (с заявками Тильды)  

Можно помочь с деплоем на Timeweb/Railway и настройкой `.env`, когда будут ключи.

## Структура

```
├── package.json
├── .env.example
├── knowledge/
│   ├── llms-full.txt
│   └── faq-extra.md
├── public/
│   └── embed.js
└── src/
    ├── index.js      # Express-сервер
    ├── chat.js       # Оркестрация диалога
    ├── ai.js         # YandexGPT / OpenAI
    ├── knowledge.js  # Загрузка базы знаний
    ├── leads.js      # Детект заявок + уведомления в MAX
    ├── max.js        # Отправка в мессенджер MAX
    ├── telegram.js   # Telegram-бот (опционально)
    └── config.js
```

## Команды Telegram (если подключён)

- `/start` — приветствие
- `/reset` — очистить историю диалога

## Заявки и отзывы Avito → MAX

Заявки от ИИ-бота (сайт / Telegram) и свежие отзывы Avito пишутся в **тот же групповой чат MAX**, куда Тильда шлёт заявки с сайта.

Важно: бот Тильды и наш бот — разные. Наш бот нужно **добавить в тот же чат**.

```bash
cp .env.example .env
# 1) MAX_BOT_TOKEN
# 2) добавьте бота в чат с заявками Тильды
# 3) узнайте chat_id:
npm run max:chat-id
# 4) пропишите MAX_CHAT_ID=... в .env

npm run check:avito
npm run check:avito -- --notify-always
npm run check:avito -- --dry-run
```

**GitHub Actions:** `.github/workflows/avito-reviews-max.yml` — каждый день в 06:00 UTC (09:00 МСК).

| Secret | Описание |
|--------|----------|
| `MAX_BOT_TOKEN` | токен **вашего** бота MAX |
| `MAX_CHAT_ID` | id группового чата с ботом Тильды |
| `AVITO_ITEM_URL` | опционально, URL объявления |

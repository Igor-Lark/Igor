# Boat Sochi Bot

ИИ-бот для [boat-sochi.ru](https://boat-sochi.ru/): чат на сайте (Tilda) + Telegram. Ответы через **YandexGPT** (или OpenAI), база знаний с сайта, заявки менеджеру в Telegram.

## Что внутри

| Компонент | Назначение |
|-----------|------------|
| Node.js API | `POST /api/chat` — ответы через YandexGPT или OpenAI |
| Виджет | Кнопка 💬 на сайте Tilda (`/embed.js`) |
| Telegram-бот | Тот же ИИ в мессенджере |
| База знаний | `knowledge/llms-full.txt` + `knowledge/faq-extra.md` |
| Заявки | При «хочу забронировать» / телефоне → уведомление менеджеру в Telegram |

## Быстрый старт (4 шага)

### 1. YandexGPT

1. [console.cloud.yandex.ru](https://console.cloud.yandex.ru) → каталог → **Folder ID**
2. Сервисный аккаунт + роль `ai.languageModels.user` → **API-ключ**

*(Альтернатива: заполните `OPENAI_API_KEY`, если Yandex не используете.)*

### 2. Telegram

1. [@BotFather](https://t.me/BotFather) → `/newbot` → токен
2. [@userinfobot](https://t.me/userinfobot) → ваш **Chat ID** (для уведомлений о заявках)

### 3. Настройка

```bash
cp .env.example .env
# заполните YANDEX_API_KEY, YANDEX_FOLDER_ID,
# TELEGRAM_BOT_TOKEN, TELEGRAM_MANAGER_CHAT_ID

npm install
npm start
```

Проверка: http://localhost:3000/health

### 4. Сервер с HTTPS

Нужен VPS или Railway/Render. В `.env`:

```env
PUBLIC_URL=https://bot.ваш-домен.ru
```

При заданном `PUBLIC_URL` Telegram переключается на webhook. Без него — polling (удобно для локальной разработки).

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
4. **Telegram** — токен бота и Chat ID менеджера  

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
    ├── leads.js      # Детект заявок + уведомления
    ├── telegram.js   # Telegram-бот
    └── config.js
```

## Команды Telegram

- `/start` — приветствие
- `/reset` — очистить историю диалога

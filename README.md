# Boat Sochi Bot

ИИ-бот для [boat-sochi.ru](https://boat-sochi.ru/): чат на сайте (Tilda) + Telegram. Ответы через **YandexGPT** (или OpenAI), база знаний с сайта, заявки менеджеру в **Telegram**.

> Ветка `cursor/boat-sochi-telegram-5814` — заявки в Telegram.  
> Параллельная ветка `cursor/boat-sochi-max-5814` — заявки в MAX.

### Общее для обеих веток (всегда синхронизируем)

Эти файлы одинаковы в Telegram- и MAX-ветках — правки знаний/правил вносятся **в обе**:

| Файл | Что внутри |
|------|------------|
| `knowledge/faq-extra.md` | FAQ, дополнительные ответы |
| `knowledge/llms-full.txt` | флот, цены, правила сервиса |
| `src/knowledge.js` | системные правила ассистента («капитан», тон, запреты) |

Различается только канал заявок: Telegram vs MAX.

## Что внутри

| Компонент | Назначение |
|-----------|------------|
| Node.js API | `POST /api/chat` — ответы через YandexGPT или OpenAI |
| Виджет | Кнопка 💬 на сайте Tilda (`/embed.js`) |
| Telegram-бот | Тот же ИИ в Telegram + заявки менеджеру |
| База знаний | `knowledge/llms-full.txt` + `knowledge/faq-extra.md` |
| Заявки | При «хочу забронировать» / телефоне → уведомление в **Telegram** |

## Быстрый старт (4 шага)

### 1. YandexGPT

1. [console.cloud.yandex.ru](https://console.cloud.yandex.ru) → каталог → **Folder ID**
2. Сервисный аккаунт + роль `ai.languageModels.user` → **API-ключ**

*(Альтернатива: заполните `OPENAI_API_KEY`, если Yandex не используете.)*

### 2. Telegram (заявки менеджеру)

1. [@BotFather](https://t.me/BotFather) → `/newbot` → токен → `TELEGRAM_BOT_TOKEN`
2. [@userinfobot](https://t.me/userinfobot) → ваш **Chat ID** → `TELEGRAM_MANAGER_CHAT_ID`

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
    ├── leads.js      # Детект заявок + уведомления в Telegram
    ├── bookings.js   # Черновики броней (напоминания пока выкл.)
    ├── chat-log.js   # Сохранение всех диалогов на диск
    ├── max.js        # MAX (опционально, Avito)
    ├── telegram.js   # Telegram-бот
    └── config.js
```

## Команды Telegram

- `/start` — приветствие
- `/reset` — очистить историю диалога

## Заявки → Telegram; отзывы Avito → MAX (опционально)

Заявки от ИИ-бота (сайт / Telegram) уходят менеджеру в **Telegram**.

Отзывы Avito по желанию можно слать в MAX (отдельные `MAX_*` в `.env`).

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

## Напоминания о выходе (готово, пока ВЫКЛЮЧЕНО)

При заявке с датой/временем бот сохраняет черновик брони в `data/bookings/`.  
Скрипт может напомнить клиенту в **MAX** за **3 часа** до выхода (по `maxUserId`).

**Сейчас ничего не шлётся.** Включение — только когда скажете:

1. В `.env`: `BOOKING_REMINDERS_ENABLED=1`
2. На VPS cron каждые ~15 мин: `npm run remind:bookings`
3. Проверка без отправки: `npm run remind:bookings -- --dry-run`

**Как появляется user_id:** клиент пишет боту в MAX → бот сохраняет `user_id` в бронь.  
Смотреть свой id в приложении MAX клиенту **не нужно** (обычно его там и нет).  
Для отладки менеджеру: `npm run max:user-id` — напишите боту в личку, скрипт напечатает id.

Ограничение: если клиент оставил только телефон на сайте и **не писал боту в MAX**, личное напоминание в MAX отправить нельзя (SMS пока нет).

## Жив ли бот? (контроль)

```bash
npm run health:ping           # проверка Telegram + /health
npm run health:ping -- --notify   # если плохо — сообщение в группу менеджеру
```

На VPS удобно поставить cron раз в 10–15 мин.  
Сейчас бот на тестовом сервере слушает Telegram через **polling** — связь иногда рвётся; в коде есть автоперезапуск polling. На постоянном VPS с HTTPS лучше **webhook** (`PUBLIC_URL=https://bot...`).

## Клиент ушёл без контакта

Если человек пообщался с ботом и **~10 минут** молчит, а телефон/контакт не оставил — в чат менеджеру уходит:

`Клиент12 · 21-07 20:04`  
`Продолжительность общения: 4 мин, контакт не оставил`

Пауза настраивается: `NO_CONTACT_IDLE_MINUTES=10` в `.env`.

## Позже (бэклог)

- **Включить напоминания о выходе** — когда скажете («включи напоминания»).
- **~30.07.2026 — заявки с Avito → MAX.** Сейчас в MAX уходят только *отзывы* Avito. Сообщения/заявки клиентов из мессенджера Avito — отдельная задача (нужен API Avito / проф. кабинет). Напомнить в чате Cursor: «заявки с Avito».

## Лог диалогов

Все переписки (сайт и Telegram) сохраняются на сервере, **даже если клиент не оставил телефон**:

| Путь | Что внутри |
|------|------------|
| `data/chats/YYYY-MM-DD.jsonl` | журнал за день (по строке на реплику) |
| `data/chats/sessions/<sessionId>.json` | полный диалог одной сессии |

Файлы на VPS, в git не попадают (приватность). Смотреть на сервере: `ls data/chats/` или открыть нужный `.json`.

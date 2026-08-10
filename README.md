# Boat Sochi Bot

ИИ-бот для [boat-sochi.ru](https://boat-sochi.ru/): чат на сайте (Tilda). Ответы через **YandexGPT** (или OpenAI), база знаний с сайта, заявки менеджеру в **MAX**.

> Рабочая ветка: `cursor/boat-contact-route-5814` (deploy на VPS).  
> Ветка `cursor/boat-sochi-max-5814` — заявки в MAX (альтернатива, синхронизировать знания при необходимости).

## Что внутри

| Компонент | Назначение |
|-----------|------------|
| Node.js API | `POST /api/chat` — ответы через YandexGPT или OpenAI |
| Виджет | Кнопка 💬 на сайте Tilda (`/embed.js`) |
| Погода | Open-Meteo: воздух + температура воды (Сириус / Сочи) |
| База знаний | `knowledge/llms-full.txt` + `faq-extra.md` + `delfin-progulki.md/json` |
| Заявки | При «хочу забронировать» / телефоне → уведомление в **MAX** |

## Быстрый старт (4 шага)

### 1. YandexGPT

1. [console.cloud.yandex.ru](https://console.cloud.yandex.ru) → каталог → **Folder ID**
2. Сервисный аккаунт + роль `ai.languageModels.user` → **API-ключ**

*(Альтернатива: заполните `OPENAI_API_KEY`, если Yandex не используете.)*

### 2. MAX (заявки менеджеру)

1. [dev.max.ru](https://dev.max.ru) → создать бота → **токен** → `MAX_BOT_TOKEN`
2. Добавьте бота в групповой чат заявок (лучше тот же, куда пишет бот Тильды)
3. На сервере: `npm run max:chat-id` → напишите боту в том чате → скопируйте `MAX_CHAT_ID` в `.env`

*(Telegram-бот для ИИ-чата с клиентами можно оставить: `TELEGRAM_BOT_TOKEN`. Заявки менеджеру в этой ветке идут в MAX.)*

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

## Заявки → MAX; отзывы Avito → MAX

Заявки от ИИ-бота (сайт / Telegram) уходят менеджеру в **MAX**.

Отзывы Avito — тоже в MAX (те же `MAX_*` в `.env`).

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

| Secret / `.env` | Описание |
|-----------------|----------|
| `MAX_BOT_TOKEN` | токен **вашего** бота MAX |
| `MAX_CHAT_ID` | id группового чата с ботом Тильды |
| `AVITO_ITEM_URL` | опционально, URL объявления |

## Напоминания о выходе (готово, пока ВЫКЛЮЧЕНО)

При заявке с датой/временем бот сохраняет черновик брони в `data/bookings/`.  
Скрипт может напомнить клиенту в Telegram за **3 часа** до выхода.

**Сейчас ничего не шлётся.** Включение — только когда скажете:

1. В `.env`: `BOOKING_REMINDERS_ENABLED=1`
2. На VPS cron каждые ~15 мин: `npm run remind:bookings`
3. Проверка без отправки: `npm run remind:bookings -- --dry-run`

Ограничение: автонапоминание уходит клиенту в Telegram (если писал боту). С сайта по телефону — SMS пока нет.

## Жив ли бот? (контроль)

```bash
npm run health:ping           # Telegram + /health + пинг YandexGPT
npm run health:ping -- --notify   # если плохо — сообщение менеджеру
npm run health:ping -- --skip-ai  # без пинга ИИ (дешевле/быстрее)
```

На VPS поставьте cron каждые 10–15 мин:

```bash
*/10 * * * * cd /var/www/boat-sochi-bot && npm run health:ping -- --notify >> /var/log/boat-sochi-health.log 2>&1
```

Дополнительно: если ИИ падает при ответе клиенту (квота/баланс Yandex и т.п.) — в чат менеджеру уходит алерт (не чаще раза в `AI_ALERT_COOLDOWN_MINUTES`, по умолчанию 30).

Сейчас бот на тестовом сервере слушает Telegram через **polling** — связь иногда рвётся; в коде есть автоперезапуск polling. На постоянном VPS с HTTPS лучше **webhook** (`PUBLIC_URL=https://bot...`).

## Клиент ушёл без контакта

Если человек пообщался с ботом и **~10 минут** молчит, а телефон/контакт не оставил — в чат менеджеру уходит:

`Клиент12 · 21-07 20:04`  
`Продолжительность общения: 4 мин, контакт не оставил`

Пауза настраивается: `NO_CONTACT_IDLE_MINUTES=10` в `.env`.

## Позже (бэклог)

- **Когда MAX для заявок стабильно работает** — убрать из ответов бота ссылку `#bot` / фразу про заявку на обратный звонок на сайте и **удалить соответствующие блоки формы на Тильде** (дубль канала заявок больше не нужен). Напомнить в чате: «убери #bot и блоки Тильды».
- **Включить напоминания о выходе** — когда скажете («включи напоминания»).
- **~30.07.2026 — заявки с Avito → MAX.** Сейчас в MAX уходят только *отзывы* Avito. Сообщения/заявки клиентов из мессенджера Avito — отдельная задача (нужен API Avito / проф. кабинет). Напомнить в чате Cursor: «заявки с Avito».
- **Чат клиентов в MAX** (как Telegram) — отдельный этап; пока только заявки менеджеру.

## Лог диалогов

Все переписки (сайт и Telegram) сохраняются на сервере, **даже если клиент не оставил телефон**:

| Путь | Что внутри |
|------|------------|
| `data/chats/YYYY-MM-DD.jsonl` | журнал за день (по строке на реплику) |
| `data/chats/sessions/<sessionId>.json` | полный диалог одной сессии |

Файлы на VPS, в git не попадают (приватность). Смотреть на сервере: `ls data/chats/` или открыть нужный `.json`.

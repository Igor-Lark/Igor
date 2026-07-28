# Запуск KlinkerPro Bot на VPS (подробно)

**Быстрые ссылки**

- [Скрипт деплоя базы знаний (GitHub)](https://github.com/Igor-Lark/Igor/blob/cursor/facade-openings-calc-bfbc/bots/klinkerpro-bot/scripts/deploy-knowledge.sh)
- [Раздел «Обновление инструкций бота» в этом файле](#10-обновление-инструкций-бота-база-знаний)
- [Проверка после деплоя — health](https://klinker.webtaxi2.ru/health)
- [Виджет на сайте — embed.js](https://klinker.webtaxi2.ru/embed.js)
- [Каталог термопанелей на Tilda](https://marmara-pro.ru/termo)

**На VPS одной командой** (из корня репозитория, путь замените на свой):

```bash
cd /var/www/igor-klinker
bash bots/klinkerpro-bot/scripts/deploy-knowledge.sh
```

После деплоя в [health](https://klinker.webtaxi2.ru/health) должно быть **`"facadeCalcVersion":3`**. Если поля нет — pm2 смотрит **не ту папку** или **старая ветка**:

```bash
bash bots/klinkerpro-bot/scripts/verify-klinker-deploy.sh
pm2 describe klinkerpro | egrep 'exec cwd|script path'
```

Скрипт деплоя пересоздаёт `klinkerpro` из `bots/klinkerpro-bot/ecosystem.config.cjs` (ветка **`cursor/facade-openings-calc-bfbc`**).

Бот: виджет на **marmara-pro.ru** + заявки в **MAX**.  
URL: **https://klinker.webtaxi2.ru** · порт процесса: **3001** (boat-sochi обычно **3000**).

Предполагается: на VPS уже работает **boat** (`boat.webtaxi2.ru`), установлены **Node.js 18+**, **nginx**, **certbot**.

---

## 0. Чеклист перед стартом

- [ ] Доступ по SSH на VPS
- [ ] Репозиторий `Igor` уже клонирован (или клонируете заново)
- [ ] В Yandex Cloud есть **API-ключ** и **Folder ID** (можно скопировать из `.env` boat)
- [ ] **MAX:** на первом запуске заявки **не шлём** (`MAX_NOTIFY_ENABLED=false` в `.env`) — достаточно виджета и YandexGPT
- [ ] Позже: бот MAX, чат заявок, `MAX_NOTIFY_ENABLED=true`
- [ ] DNS: **`klinker.webtaxi2.ru`** → A-запись на IP VPS (как у `boat.webtaxi2.ru`)

---

## 1. DNS

В панели Reg.ru / Beget / где зона **webtaxi2.ru**:

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `klinker` | IP вашего VPS |

Проверка (с своего ПК или VPS):

```bash
dig +short klinker.webtaxi2.ru
```

Должен вернуться IP сервера. Подождите 5–30 минут после создания записи.

---

## 2. Код на сервере

Подключитесь по SSH и перейдите в каталог репозитория (путь замените на свой):

```bash
cd ~/igor   # или /var/www/igor — как у вас лежит boat
git fetch origin
git checkout cursor/facade-openings-calc-bfbc
git pull origin cursor/facade-openings-calc-bfbc
cd bots/klinkerpro-bot
```

Если репозитория ещё нет:

```bash
git clone https://github.com/Igor-Lark/Igor.git ~/igor
cd ~/igor
git checkout cursor/facade-openings-calc-bfbc
cd bots/klinkerpro-bot
```

---

## 3. Зависимости Node

```bash
node -v    # нужно v18 или выше
npm install
```

---

## 4. Файл `.env`

```bash
cp .env.example .env
nano .env   # или vim
```

### 4.1. Самый быстрый путь — скопировать с boat

Если boat лежит рядом, например `~/igor/bots/...` или отдельная папка:

```bash
# пример: посмотреть, где boat
ls ~/boat-sochi-bot/.env 2>/dev/null || ls ~/igor/bots/*/\.env 2>/dev/null
```

Скопируйте из `.env` boat только **YANDEX_API_KEY** и **YANDEX_FOLDER_ID**.  
Токены **MAX** пока **не нужны** (заявки в MAX отключены).

### 4.2. Обязательные поля для KlinkerPro

```env
YANDEX_API_KEY=AQVN...
YANDEX_FOLDER_ID=b1g...
YANDEX_MODEL=yandexgpt-lite

MAX_NOTIFY_ENABLED=false

PORT=3001
PUBLIC_URL=https://klinker.webtaxi2.ru
BOT_NAME=КлинкерПрофи

TZ=Europe/Moscow
```

**Telegram** для этого бота **не заполняйте**, если не нужен отдельный TG-бот.

### 4.3. Когда включите MAX (не сейчас)

1. `MAX_BOT_TOKEN`, `MAX_CHAT_ID` (при необходимости `npm run max:chat-id`)
2. `MAX_NOTIFY_ENABLED=true`
3. `sudo systemctl restart klinkerpro-bot` — в `/health` будет `"maxNotify": true`

---

## 5. Пробный запуск вручную

```bash
cd ~/igor/bots/klinkerpro-bot
npm start
```

В **другом** SSH-окне:

```bash
curl -s http://127.0.0.1:3001/health
```

Ожидаемый ответ (пример):

```json
{
  "ok": true,
  "bot": "КлинкерПрофи",
  "ai": "yandex",
  "telegram": false,
  "maxNotify": false,
  "maxNotifyEnabled": false,
  "knowledgeChars": 8000,
  "publicUrl": "https://klinker.webtaxi2.ru"
}
```

Проверка ИИ:

```bash
curl -s http://127.0.0.1:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Чем термопанели лучше мокрого фасада?"}]}'
```

Должен прийти JSON с полем `"reply"`.

Остановите ручной запуск: `Ctrl+C`.

---

## 6. systemd (автозапуск)

```bash
sudo nano /etc/systemd/system/klinkerpro-bot.service
```

Содержимое (пути и пользователя замените):

```ini
[Unit]
Description=KlinkerPro AI bot (marmara-pro.ru)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/home/YOUR_USER/igor/bots/klinkerpro-bot
Environment=NODE_ENV=production
Environment=TZ=Europe/Moscow
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Если boat крутится под другим пользователем (`ubuntu`, `deploy`) — укажите **того же**, у кого есть права на каталог и `.env`.

```bash
sudo chown -R www-data:www-data /home/YOUR_USER/igor/bots/klinkerpro-bot
# или ваш пользователь без смены владельца, если User=ubuntu

sudo systemctl daemon-reload
sudo systemctl enable klinkerpro-bot
sudo systemctl start klinkerpro-bot
sudo systemctl status klinkerpro-bot
```

Логи:

```bash
journalctl -u klinkerpro-bot -f
```

---

## 7. Nginx + HTTPS

Создайте конфиг (имя файла может отличаться):

```bash
sudo nano /etc/nginx/sites-available/klinker.webtaxi2.ru
```

```nginx
server {
    listen 80;
    server_name klinker.webtaxi2.ru;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/klinker.webtaxi2.ru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d klinker.webtaxi2.ru
```

Проверка снаружи:

```bash
curl -s https://klinker.webtaxi2.ru/health
curl -sI https://klinker.webtaxi2.ru/embed.js | head -5
```

---

## 8. Tilda (marmara-pro.ru)

1. Откройте проект **marmara-pro.ru** в Tilda.
2. **Настройки сайта** → **Ещё** → **HTML-код для вставки внутрь HEAD** — **не нужен** для бота.
3. **HTML перед `</body>`** (на всём сайте или только на нужных страницах):

```html
<script src="https://klinker.webtaxi2.ru/embed.js"></script>
```

Маскот `klinker-PNG.png` (Tilda): **100 px над кнопкой** (desktop) и **в приветствии диалога** (desktop). URL по умолчанию в embed; переопределение: `data-mascot-src` или `WIDGET_MASCOT_URL`.

4. Опубликуйте сайт.
5. Откройте https://marmara-pro.ru/termo — в углу должна появиться кнопка чата.
6. Задайте вопрос — ответ ИИ должен приходить в виджет. **MAX** пока не проверяем (`MAX_NOTIFY_ENABLED=false`).

Якорь `#bot` на странице — для ссылок «оставить заявку» внутри виджета.

---

## 9. Заявки в MAX (отложено)

Сейчас заявки **не отправляются** — только чат на сайте. Когда будете готовы: раздел **4.3** и тест фразой «хочу заказать, +7…» → сообщение **«Новая заявка — КлинкерПрофи»** в чат MAX.

---

## 10. Обновление инструкций бота (база знаний)

После правок в GitHub (FAQ, `site-home.md`, `site-termo.md`, `src/knowledge.js`) на VPS:

```bash
cd /var/www/igor-klinker          # или ~/igor — ваш путь к репозиторию
bash bots/klinkerpro-bot/scripts/deploy-knowledge.sh
```

Скрипт делает `git pull` ветки `cursor/facade-openings-calc-bfbc` и **`pm2 restart klinkerpro`**.

Вручную:

```bash
cd /var/www/igor-klinker
git fetch origin
git checkout cursor/facade-openings-calc-bfbc
git pull origin cursor/facade-openings-calc-bfbc
pm2 restart klinkerpro
curl -s http://127.0.0.1:3001/health
```

**Что подхватывается без Tilda:**

| Файл | Назначение |
|------|------------|
| `knowledge/site-home.md` | Тексты с главной marmara-pro.ru |
| `knowledge/site-termo.md` | Каталог /termo (размеры панелей и т.д.) |
| `knowledge/site-termo-catalog.md` | Цены и названия термопанелей с карточек /termo |
| `knowledge/faq.md` | FAQ |
| `src/knowledge.js` | Сборка промпта, приветствия, запрет гибкого кирpicha/камня/доски |

**Виджет** (`public/embed.js`) на Tilda обновляется отдельно — с `https://klinker.webtaxi2.ru/embed.js` после деплоя статики на klinker (если меняли embed).

Микроразметка и `llms.txt` для сайта — только Tilda/хостинг сайта, **на VPS бота не копируются**.

---

## 11. Частые проблемы

| Симптом | Что проверить |
|---------|----------------|
| `ai: "none"` в health | `YANDEX_API_KEY`, `YANDEX_FOLDER_ID` в `.env` |
| 502 Bad Gateway | `systemctl status klinkerpro-bot`, порт 3001 не занят другим процессом |
| Виджет не появляется | Скрипт в Tilda опубликован; в консоли браузера (F12) нет блокировки `embed.js` |
| CORS / чат молчит | Открывайте сайт с HTTPS; `embed.js` грузится с `klinker.webtaxi2.ru` |
| MAX не шлёт | `MAX_BOT_TOKEN`, `MAX_CHAT_ID`; тест `npm run max:chat-id` |
| ИИ «упал» | Баланс Yandex Cloud; `journalctl -u klinkerpro-bot`; алерт в MAX (если настроен) |

Мониторинг (опционально, cron раз в 5–10 мин):

```bash
cd ~/igor/bots/klinkerpro-bot && npm run health:ping -- --notify
```

---

## 12. Два бота на одном VPS

| Сервис | Домен | Порт | systemd |
|--------|--------|------|---------|
| boat-sochi | boat.webtaxi2.ru | 3000 | свой unit |
| klinkerpro | klinker.webtaxi2.ru | 3001 | `klinkerpro-bot` |

Порты **не должны совпадать**. Yandex можно **общий** с boat. MAX — подключите позже отдельным флагом `MAX_NOTIFY_ENABLED`.

---

Краткая версия: [README.md](README.md)

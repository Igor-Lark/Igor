# Запуск KlinkerPro Bot на VPS (подробно)

Бот: виджет на **marmara-pro.ru** + заявки в **MAX**.  
URL: **https://klinker.webtaxi2.ru** · порт процесса: **3001** (boat-sochi обычно **3000**).

Предполагается: на VPS уже работает **boat** (`boat.webtaxi2.ru`), установлены **Node.js 18+**, **nginx**, **certbot**.

---

## 0. Чеклист перед стартом

- [ ] Доступ по SSH на VPS
- [ ] Репозиторий `Igor` уже клонирован (или клонируете заново)
- [ ] В Yandex Cloud есть **API-ключ** и **Folder ID** (можно скопировать из `.env` boat)
- [ ] В [dev.max.ru](https://dev.max.ru) есть бот MAX (можно **тот же**, что для boat, или **новый**)
- [ ] Бот MAX добавлен в **групповой чат заявок** (куда должны падать лиды)
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
git checkout cursor/termopaneli-bot-bfbc
git pull origin cursor/termopaneli-bot-bfbc
cd bots/klinkerpro-bot
```

Если репозитория ещё нет:

```bash
git clone https://github.com/Igor-Lark/Igor.git ~/igor
cd ~/igor
git checkout cursor/termopaneli-bot-bfbc
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

Скопируйте из `.env` boat строки **YANDEX_API_KEY**, **YANDEX_FOLDER_ID**, **MAX_BOT_TOKEN**, **MAX_CHAT_ID** (если заявки должны идти в **тот же чат**, что и boat).

### 4.2. Обязательные поля для KlinkerPro

```env
YANDEX_API_KEY=AQVN...
YANDEX_FOLDER_ID=b1g...
YANDEX_MODEL=yandexgpt-lite

MAX_BOT_TOKEN=...
MAX_CHAT_ID=...

PORT=3001
PUBLIC_URL=https://klinker.webtaxi2.ru
BOT_NAME=КлинкерПрофи

TZ=Europe/Moscow
```

**Telegram** для этого бота **не заполняйте**, если не нужен отдельный TG-бот.

### 4.3. Узнать `MAX_CHAT_ID` (если ещё нет)

На VPS в каталоге бота:

```bash
npm run max:chat-id
```

В течение 3 минут **напишите любое сообщение** в групповой чат MAX, куда добавлен бот. Скрипт выведет `chat_id` — вставьте в `.env` как `MAX_CHAT_ID=...`, перезапустите бота (шаг 6).

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
  "maxNotify": true,
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

4. Опубликуйте сайт.
5. Откройте https://marmara-pro.ru/termo — в углу должна появиться кнопка чата.
6. Задайте вопрос; при фразе «хочу заказать, телефон +7…» проверьте **MAX** (чат заявок).

Якорь `#bot` на странице — для ссылок «оставить заявку» внутри виджета.

---

## 9. Проверка заявок в MAX

Напишите в виджете, например:

> Хочу заказать термопанели, перезвоните +7 921 745-77-55

В MAX должно прийти сообщение с заголовком **«Новая заявка — КлинкерПрофи»**.

Если не приходит:

- `maxNotify: true` в `/health`
- верный `MAX_CHAT_ID`
- бот **админ** или имеет право писать в чат
- логи: `journalctl -u klinkerpro-bot -n 50`

---

## 10. Обновление бота после правок в GitHub

```bash
cd ~/igor/bots/klinkerpro-bot
git pull origin cursor/termopaneli-bot-bfbc
npm install
sudo systemctl restart klinkerpro-bot
```

Если меняли только FAQ:

```bash
cp ../../agents/termopaneli/faq.md knowledge/faq.md
sudo systemctl restart klinkerpro-bot
```

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

Порты **не должны совпадать**. Yandex и MAX можно **общие** (один ключ, один чат заявок) или разделить позже.

---

Краткая версия: [README.md](README.md)

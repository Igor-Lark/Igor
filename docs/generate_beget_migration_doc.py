#!/usr/bin/env python3
"""Generate Beget VPS migration guide for boat + klinker bots."""

from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from pathlib import Path

OUT = Path(__file__).parent / "beget-migration-boat-klinker.docx"


def add_heading(doc, text, level=1):
    return doc.add_heading(text, level=level)


def add_para(doc, text, bold=False, italic=False):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(11)
    return p


def add_code(doc, text):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = "Consolas"
    run.font.size = Pt(9)
    p.paragraph_format.left_indent = Cm(0.5)
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(4)
    return p


def add_bullet(doc, text):
    p = doc.add_paragraph(text, style="List Bullet")
    for run in p.runs:
        run.font.size = Pt(11)
    return p


def add_table(doc, headers, rows):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        for p in hdr[i].paragraphs:
            for run in p.runs:
                run.bold = True
    for ri, row in enumerate(rows):
        cells = table.rows[ri + 1].cells
        for ci, val in enumerate(row):
            cells[ci].text = str(val)
    doc.add_paragraph()
    return table


def build():
    doc = Document()

    # Title
    title = doc.add_heading(
        "Перенос ботов REG.RU → Beget: код и обучение (без логов и мусора)", 0
    )
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    add_para(
        doc,
        "Чистая установка на VPS Beget: только программный код ботов и база знаний (инструкции для ИИ). "
        "Старые логи, pm2-логи, node_modules, архивы /var/www и прочий «хвост» с REG.RU не переносятся. "
        "Секреты — только YandexGPT в .env. Без MAX, Telegram и веток под мессенджеры. "
        "Сервисы: boat.webtaxi2.ru и klinker.webtaxi2.ru. "
        "Документ обновлён: 6 октября 2026 г.",
        italic=True,
    )
    doc.add_paragraph()

    # TOC-like section list
    add_heading(doc, "Содержание", 1)
    toc = [
        "1. Что переносим и зачем",
        "1.2–1.8. Код + обучение; без MAX/Telegram; ветки Git; .env; DNS",
        "2. Что заказать на Beget",
        "3. Домены и DNS",
        "4. Первичная настройка VPS",
        "5. Установка Node.js, nginx, certbot, pm2",
        "6. Перенос бота Boat Sochi (boat-sochi.ru)",
        "7. Перенос бота KlinkerPro (marmara-pro.ru)",
        "8. Nginx: конфигурации для обоих ботов",
        "9. SSL-сертификаты (Let's Encrypt)",
        "10. Обновление виджетов на Tilda",
        "11. Cron: мониторинг и фоновые задачи",
        "12. План переключения (cutover) со старого VPS",
        "13. Проверка после миграции",
        "14. Частые проблемы",
        "15. Полезные ссылки",
    ]
    for item in toc:
        add_bullet(doc, item)

    # Section 1
    add_heading(doc, "1. Что переносим и зачем", 1)
    add_para(
        doc,
        "На одном VPS работают два независимых Node.js-приложения — ИИ-чаты для сайтов на Tilda. "
        "Каждый бот слушает свой порт, снаружи доступен через HTTPS и поддомен.",
    )
    add_table(
        doc,
        ["Бот", "Сайт", "Текущий URL", "Порт", "Ветка GitHub", "Назначение"],
        [
            [
                "Boat Sochi",
                "boat-sochi.ru",
                "https://boat.webtaxi2.ru",
                "3000",
                "cursor/boat-contact-route-5814",
                "Только виджет на сайте (Tilda) + YandexGPT; без MAX и Telegram",
            ],
            [
                "KlinkerPro",
                "marmara-pro.ru/termo",
                "https://klinker.webtaxi2.ru",
                "3001",
                "cursor/termopaneli-bot-bfbc",
                "Только виджет на marmara-pro.ru; без MAX и Telegram",
            ],
        ],
    )
    add_para(doc, "Репозиторий: https://github.com/Igor-Lark/Igor", bold=False)
    add_para(
        doc,
        "После переноса VPS на REG.RU можно отключить (или оставить резервом на 1–2 недели), "
        "когда новые адреса протестированы и виджеты на Tilda обновлены.",
    )

    add_heading(doc, "1.1. Где что лежит сейчас (REG.RU)", 2)
    add_table(
        doc,
        ["Что", "Где сейчас (REG.RU VPS)", "Куда (Beget VPS)"],
        [
            ["Boat Sochi", "/var/www/boat-sochi-bot, порт 3000", "тот же путь или /var/www/boat-sochi-bot"],
            ["KlinkerPro", "~/igor/bots/klinkerpro-bot или /var/www/igor-klinker, порт 3001", "/var/www/igor/bots/klinkerpro-bot"],
            ["DNS boat/klinker", "Панель REG.RU → DNS зона webtaxi2.ru (A-записи)", "REG.RU или Beget — см. раздел 3"],
            ["SSL", "Let's Encrypt на старом VPS (certbot)", "Новый certbot на Beget после nginx"],
        ],
    )
    add_para(
        doc,
        "С REG.RU понадобится только скопировать .env (секреты). Код и обучение — из GitHub (разделы 1.3–1.5, 6–7).",
    )

    add_heading(doc, "1.2. Принцип: чистый Beget, без «переезда диска»", 2)
    add_para(
        doc,
        "VPS на Beget поднимается с нуля. С REG.RU не копируем сервер целиком и не тащим логи. "
        "Источник правды для кода и инструкций — репозиторий GitHub; на Beget делаем git clone / git pull "
        "нужных веток, npm install, новые nginx и certbot.",
    )

    add_heading(doc, "1.3. Что переносим на Beget", 2)
    add_table(
        doc,
        ["Категория", "Boat Sochi", "KlinkerPro", "Как доставить"],
        [
            [
                "Программный код",
                "src/, public/, package.json, scripts/",
                "bots/klinkerpro-bot/src/, public/, …",
                "git checkout нужной ветки + npm install",
            ],
            [
                "Обучение (база знаний)",
                "knowledge/*.md, *.txt, *.json",
                "bots/klinkerpro-bot/knowledge/*.md",
                "В репозитории; git pull. См. 1.4",
            ],
            [
                "Логика промпта",
                "src/knowledge.js, chat.js, …",
                "src/knowledge.js",
                "В репозитории",
            ],
            [
                "Секреты",
                ".env (только YandexGPT)",
                ".env (только YandexGPT)",
                "scp с REG.RU или вручную; MAX/Telegram не заполняем",
            ],
        ],
    )

    add_heading(doc, "1.3.1. MAX и Telegram — не используем", 3)
    add_para(
        doc,
        "На Beget боты работают только как чат на сайте (embed.js → POST /api/chat). "
        "Интеграции с мессенджерами и MAX не настраиваем: токены пустые, cron без уведомлений в MAX.",
    )
    add_table(
        doc,
        ["Ветка GitHub", "Нужна на Beget?", "Комментарий"],
        [
            ["cursor/boat-contact-route-5814", "Да", "Основной boat: виджет + knowledge"],
            ["cursor/termopaneli-bot-bfbc", "Да", "KlinkerPro в bots/klinkerpro-bot/"],
            ["cursor/boat-sochi-max-5814", "Нет", "Заявки в MAX — не деплоим"],
            ["cursor/boat-sochi-telegram-5814", "Нет", "Telegram-бот — не деплоим"],
            ["cursor/boat-sochi-bot-5814", "Нет", "Отдельная Telegram-ветка — не нужна"],
        ],
    )

    add_heading(doc, "1.4. Файлы обучения (knowledge) — список", 2)
    add_para(doc, "Boat (ветка cursor/boat-contact-route-5814), типичные файлы:")
    add_bullet(doc, "knowledge/llms-full.txt — основной текст с boat-sochi.ru")
    add_bullet(doc, "knowledge/faq-extra.md — доп. FAQ")
    add_bullet(doc, "knowledge/delfin-progulki.md, group-fishing.md, fishing-season-sochi.md")
    add_bullet(doc, "knowledge/*.json — структурированные подсказки, если есть в ветке")
    add_para(doc, "Klinker (ветка cursor/termopaneli-bot-bfbc):")
    add_bullet(doc, "knowledge/site-home.md, site-termo.md, site-termo-catalog.md, faq.md")
    add_para(
        doc,
        "Если на REG.RU правили knowledge только на сервере и не пушили в Git — один раз скопируйте "
        "только каталог knowledge (без логов):",
    )
    add_code(
        doc,
        "scp -r root@СТАРЫЙ_IP_REGRU:/var/www/boat-sochi-bot/knowledge/ ./boat-knowledge-backup/\n"
        "scp -r root@СТАРЫЙ_IP_REGRU:/var/www/igor/bots/klinkerpro-bot/knowledge/ ./klinker-knowledge-backup/\n"
        "# затем на Beget положить в те же пути после git clone",
    )

    add_heading(doc, "1.5. Что НЕ переносим с REG.RU", 2)
    add_table(
        doc,
        ["Не переносим", "Почему", "На Beget"],
        [
            ["~/.pm2/logs, pm2 log files", "Старые логи не нужны", "Новые логи pm2 с нуля"],
            ["/var/log/*", "Системные и app-логи", "Пустые каталоги"],
            ["node_modules/", "Тяжёлый, привязан к ОС", "npm install на Beget"],
            [".git/objects (если не через git)", "Лишнее", "git clone заново"],
            ["Архивы backup-*.tar.gz", "Мусор", "Не копировать"],
            ["/etc/letsencrypt", "Привязка к старому серверу", "certbot --nginx заново"],
            ["dump.pm2, старый cron «как есть»", "Может ссылаться на старые пути", "pm2 start вручную; cron из раздела 11"],
            ["Весь /var/www целиком rsync", "Тянет логи и мусор", "Только Git + .env (+ knowledge при необходимости)"],
        ],
    )

    add_heading(doc, "1.6. Секреты: только .env с REG.RU", 2)
    add_code(
        doc,
        "scp root@СТАРЫЙ_IP_REGRU:/var/www/boat-sochi-bot/.env deploy@IP_BEGET:/var/www/boat-sochi-bot/.env\n"
        "scp root@СТАРЫЙ_IP_REGRU:/var/www/igor/bots/klinkerpro-bot/.env \\\n"
        "    deploy@IP_BEGET:/var/www/igor/bots/klinkerpro-bot/.env\n"
        "# пути klinker на REG.RU могут быть ~/igor/bots/klinkerpro-bot/.env — проверьте ls",
    )
    add_para(
        doc,
        "На Beget в .env укажите PUBLIC_URL и ключи YandexGPT. Поля MAX_* и TELEGRAM_* оставьте пустыми "
        "(если скопировали старый .env — удалите или очистите эти строки).",
    )

    add_heading(doc, "1.7. DNS (только боты)", 2)
    add_para(
        doc,
        "Для миграции ботов достаточно сменить A-записи поддоменов API (остальные сайты на REG.RU не трогаем, "
        "если они там же не крутятся):",
    )
    add_table(
        doc,
        ["Запись", "Действие"],
        [
            ["boat.webtaxi2.ru (или новый поддомен)", "A → IP VPS Beget"],
            ["klinker.webtaxi2.ru (или новый поддомен)", "A → IP VPS Beget"],
            ["TTL", "300–600 сек за сутки до переключения"],
        ],
    )
    add_para(
        doc,
        "Пока DNS указывает на REG.RU — боты там продолжают работать. Переключайте A-записи после проверки health на Beget.",
    )

    # Section 2
    add_heading(doc, "2. Что заказать на Beget", 1)
    add_heading(doc, "2.1. Тариф VPS", 2)
    add_bullet(doc, "Раздел Beget → «VPS/VDS» → Ubuntu 22.04 или 24.04 LTS.")
    add_bullet(doc, "Для двух ботов без логов и без лишних сайтов: 1 vCPU, 2 GB RAM, 10–15 GB SSD достаточно.")
    add_bullet(doc, "Полный объём REG.RU не важен — переносим только код и knowledge (несколько мегабайт + node_modules после npm install).")
    add_bullet(doc, "Регион: любой с низкой задержкой до России (Москва/СПб, если доступен).")

    add_heading(doc, "2.2. Что понадобится заранее", 2)
    add_bullet(doc, "Доступ по SSH (логин root или пользователь с sudo).")
    add_bullet(doc, "Ключи YandexGPT (из старого .env или Yandex Cloud); MAX/Telegram не нужны.")
    add_bullet(doc, "Доступ к панели DNS Beget (домены уже есть у вас).")
    add_bullet(doc, "Доступ к Tilda: boat-sochi.ru и marmara-pro.ru — для смены URL embed.js.")

    # Section 3
    add_heading(doc, "3. Домены и DNS", 1)
    add_para(
        doc,
        "Ботам нужны отдельные поддомены с HTTPS. Два варианта — выберите один.",
    )

    add_heading(doc, "3.1. Вариант A — поддомены на вашем домене в Beget (рекомендуется)", 2)
    add_para(
        doc,
        "Если у вас на Beget есть домен, например example.ru, создайте поддомены второго уровня:",
    )
    add_table(
        doc,
        ["Тип", "Имя (поддомен)", "Значение", "Назначение"],
        [
            ["A", "boat-bot", "IP нового VPS Beget", "Boat Sochi bot"],
            ["A", "klinker-bot", "IP нового VPS Beget", "KlinkerPro bot"],
        ],
    )
    add_para(doc, "Итоговые URL:")
    add_bullet(doc, "Boat: https://boat-bot.example.ru")
    add_bullet(doc, "Klinker: https://klinker-bot.example.ru")
    add_para(
        doc,
        "В панели Beget: «Домены» → ваш домен → «Поддомены» или «DNS-зона» → добавить A-записи. "
        "TTL: 300–600 сек. Распространение DNS: 5–30 минут, иногда до 2 часов.",
    )

    add_heading(doc, "3.2. Вариант B — оставить boat.webtaxi2.ru и klinker.webtaxi2.ru (удобнее)", 2)
    add_para(
        doc,
        "URL ботов не меняются — на Tilda менять embed.js не нужно. Меняется только IP в DNS.",
    )
    add_heading(doc, "3.2.1. DNS в REG.RU (если webtaxi2.ru обслуживается REG.RU)", 3)
    add_para(
        doc,
        "Личный кабинет REG.RU → «Домены» → webtaxi2.ru → «Управление зоной DNS» / «Ресурсные записи»:",
    )
    add_table(
        doc,
        ["Тип", "Поддомен (хост)", "Было (IP REG.RU VPS)", "Стало"],
        [
            ["A", "boat", "старый IP VPS REG.RU", "новый IP VPS Beget"],
            ["A", "klinker", "старый IP VPS REG.RU", "новый IP VPS Beget"],
        ],
    )
    add_para(
        doc,
        "Сохраните записи. TTL после смены: подождите 5–30 минут (иногда до 2 часов). "
        "Пока DNS не переключили — тестируйте ботов на Beget по curl к IP или через временный поддомен (вариант A).",
    )
    add_heading(doc, "3.2.2. DNS в Beget (если зону webtaxi2.ru уже перенесли на Beget)", 3)
    add_para(doc, "Beget → «Домены» → webtaxi2.ru → DNS → те же A-записи boat и klinker на IP Beget VPS.")
    add_table(
        doc,
        ["Тип", "Имя", "Новое значение"],
        [
            ["A", "boat", "IP VPS Beget"],
            ["A", "klinker", "IP VPS Beget"],
        ],
    )

    add_heading(doc, "3.3. Проверка DNS", 2)
    add_code(
        doc,
        "dig +short boat-bot.example.ru\n"
        "dig +short klinker-bot.example.ru\n"
        "# или для webtaxi2.ru:\n"
        "dig +short boat.webtaxi2.ru\n"
        "dig +short klinker.webtaxi2.ru",
    )
    add_para(doc, "Должен вернуться IP вашего нового VPS Beget.")

    # Section 4
    add_heading(doc, "4. Первичная настройка VPS", 1)
    add_para(doc, "Подключитесь по SSH (IP и пароль/ключ из письма Beget после заказа VPS):")
    add_code(doc, "ssh root@ВАШ_IP_BEGET")
    add_para(doc, "Обновление системы и базовые пакеты:")
    add_code(
        doc,
        "apt update && apt upgrade -y\n"
        "apt install -y git curl wget ufw fail2ban unzip",
    )
    add_para(doc, "Часовой пояс (важно для напоминаний boat и cron):")
    add_code(
        doc,
        "timedatectl set-timezone Europe/Moscow\ntimedatectl",
    )
    add_para(doc, "Создайте пользователя для деплоя (не обязательно root):")
    add_code(
        doc,
        "adduser deploy\n"
        "usermod -aG sudo deploy\n"
        "# скопируйте SSH-ключ:\n"
        "mkdir -p /home/deploy/.ssh\n"
        "cp /root/.ssh/authorized_keys /home/deploy/.ssh/\n"
        "chown -R deploy:deploy /home/deploy/.ssh",
    )
    add_para(doc, "Firewall (открыть SSH, HTTP, HTTPS):")
    add_code(
        doc,
        "ufw allow OpenSSH\n"
        "ufw allow 80/tcp\n"
        "ufw allow 443/tcp\n"
        "ufw enable\n"
        "ufw status",
    )

    # Section 5
    add_heading(doc, "5. Установка Node.js, nginx, certbot, pm2", 1)
    add_heading(doc, "5.1. Node.js 20 LTS", 2)
    add_code(
        doc,
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -\n"
        "apt install -y nodejs\n"
        "node -v   # v20.x\n"
        "npm -v",
    )

    add_heading(doc, "5.2. pm2 (менеджер процессов)", 2)
    add_code(doc, "npm install -g pm2\npm2 startup\n# выполните команду, которую выведет pm2 startup")

    add_heading(doc, "5.3. nginx", 2)
    add_code(doc, "apt install -y nginx\nsystemctl enable nginx\nsystemctl start nginx")

    add_heading(doc, "5.4. certbot (Let's Encrypt)", 2)
    add_code(
        doc,
        "apt install -y certbot python3-certbot-nginx\n"
        "# сертификаты выпустим после настройки nginx (раздел 9)",
    )

    # Section 6 - Boat
    add_heading(doc, "6. Перенос бота Boat Sochi (boat-sochi.ru)", 1)
    add_heading(doc, "6.1. Клонирование кода", 2)
    add_code(
        doc,
        "mkdir -p /var/www\n"
        "cd /var/www\n"
        "git clone https://github.com/Igor-Lark/Igor.git boat-sochi-bot\n"
        "cd boat-sochi-bot\n"
        "git fetch origin cursor/boat-contact-route-5814\n"
        "git checkout cursor/boat-contact-route-5814\n"
        "git pull origin cursor/boat-contact-route-5814",
    )
    add_para(
        doc,
        "Примечание: boat-sochi-bot — отдельная копия репозitorия в корне ветки "
        "(не папка bots/). На старом VPS путь был /var/www/boat-sochi-bot — сохраняем ту же структуру.",
    )

    add_heading(doc, "6.2. Зависимости", 2)
    add_code(doc, "cd /var/www/boat-sochi-bot\nnpm install")

    add_heading(doc, "6.3. Файл .env", 2)
    add_para(doc, "Скопируйте .env со старого VPS или создайте из шаблона:")
    add_code(doc, "cp .env.example .env\nnano .env")
    add_para(doc, "Минимальный .env (только сайт + ИИ; MAX и Telegram не заполняем):")
    add_code(
        doc,
        "# --- AI: YandexGPT (обязательно) ---\n"
        "YANDEX_API_KEY=AQVN...\n"
        "YANDEX_FOLDER_ID=b1g...\n"
        "YANDEX_MODEL=yandexgpt-lite\n\n"
        "# --- MAX / Telegram / Avito — не используем на Beget ---\n"
        "TELEGRAM_BOT_TOKEN=\n"
        "MAX_BOT_TOKEN=\n"
        "MAX_CHAT_ID=\n"
        "MAX_USER_ID=\n\n"
        "# --- Сервер ---\n"
        "PORT=3000\n"
        "PUBLIC_URL=https://boat.webtaxi2.ru\n"
        "BOT_NAME=Boat Sochi\n"
        "TZ=Europe/Moscow\n\n"
        "BOOKING_REMINDERS_ENABLED=0\n"
        "NO_CONTACT_IDLE_MINUTES=10\n"
        "AI_ALERT_COOLDOWN_MINUTES=30",
    )
    add_para(
        doc,
        "Можно взять YANDEX_* из старого .env на REG.RU (scp), остальное — как выше:",
    )
    add_code(
        doc,
        "# Старый IP — из REG.RU → VPS; новый IP — из письма Beget после заказа VPS\n"
        "scp root@СТАРЫЙ_IP_REGRU:/var/www/boat-sochi-bot/.env deploy@НОВЫЙ_IP_BEGET:/var/www/boat-sochi-bot/.env\n"
        "# Klinker .env (путь на REG.RU может отличаться):\n"
        "scp root@СТАРЫЙ_IP_REGRU:/var/www/igor/bots/klinkerpro-bot/.env deploy@НОВЫЙ_IP_BEGET:/var/www/igor/bots/klinkerpro-bot/.env",
    )
    add_para(doc, "После копирования отредактируйте PUBLIC_URL на новый домен.")

    add_heading(doc, "6.4. Тестовый запуск", 2)
    add_code(
        doc,
        "cd /var/www/boat-sochi-bot\n"
        "npm start\n"
        "# в другом окне SSH:\n"
        "curl -s http://127.0.0.1:3000/health",
    )
    add_para(
        doc,
        "В ответе health должны быть флаги: seaRoute, contactCallback, wake, groupSailing, "
        "groupFishing, delfinCharter, streamingUi. Остановите тест: Ctrl+C.",
    )

    add_heading(doc, "6.5. Запуск через pm2", 2)
    add_code(
        doc,
        "cd /var/www/boat-sochi-bot\n"
        "pm2 start src/index.js --name boat-sochi\n"
        "pm2 save",
    )

    add_heading(doc, "6.6. Альтернатива: systemd", 2)
    add_para(doc, "Если предпочитаете systemd вместо pm2:")
    add_code(
        doc,
        "cat > /etc/systemd/system/boat-sochi-bot.service << 'EOF'\n"
        "[Unit]\n"
        "Description=Boat Sochi AI bot\n"
        "After=network.target\n\n"
        "[Service]\n"
        "Type=simple\n"
        "User=deploy\n"
        "WorkingDirectory=/var/www/boat-sochi-bot\n"
        "Environment=NODE_ENV=production\n"
        "Environment=TZ=Europe/Moscow\n"
        "ExecStart=/usr/bin/node src/index.js\n"
        "Restart=always\n"
        "RestartSec=5\n\n"
        "[Install]\n"
        "WantedBy=multi-user.target\n"
        "EOF\n\n"
        "systemctl daemon-reload\n"
        "systemctl enable boat-sochi-bot\n"
        "systemctl start boat-sochi-bot",
    )

    # Section 7 - Klinker
    add_heading(doc, "7. Перенос бота KlinkerPro (marmara-pro.ru)", 1)
    add_heading(doc, "7.1. Клонирование (отдельная копия или один репозиторий)", 2)
    add_para(doc, "Вариант 1 — один репозиторий для обоих ботов (удобнее обновлять):")
    add_code(
        doc,
        "cd /var/www\n"
        "git clone https://github.com/Igor-Lark/Igor.git igor\n"
        "cd igor\n"
        "git fetch origin cursor/termopaneli-bot-bfbc\n"
        "git checkout cursor/termopaneli-bot-bfbc\n"
        "git pull origin cursor/termopaneli-bot-bfbc\n"
        "cd bots/klinkerpro-bot\n"
        "npm install",
    )
    add_para(doc, "Вариант 2 — если boat уже в /var/www/boat-sochi-bot, можно клонировать igor отдельно.")

    add_heading(doc, "7.2. Файл .env", 2)
    add_code(
        doc,
        "cd /var/www/igor/bots/klinkerpro-bot\n"
        "cp .env.example .env\n"
        "nano .env",
    )
    add_code(
        doc,
        "YANDEX_API_KEY=...          # можно те же, что у boat\n"
        "YANDEX_FOLDER_ID=...\n"
        "YANDEX_MODEL=yandexgpt-lite\n\n"
        "MAX_NOTIFY_ENABLED=false\n"
        "TELEGRAM_BOT_TOKEN=\n"
        "MAX_BOT_TOKEN=\n"
        "MAX_CHAT_ID=\n\n"
        "PORT=3001\n"
        "PUBLIC_URL=https://klinker-bot.example.ru\n"
        "# или: PUBLIC_URL=https://klinker.webtaxi2.ru\n"
        "BOT_NAME=КлинкерПрофи\n"
        "TZ=Europe/Moscow\n"
        "NO_CONTACT_IDLE_MINUTES=10\n"
        "AI_ALERT_COOLDOWN_MINUTES=30",
    )

    add_heading(doc, "7.3. Запуск", 2)
    add_code(
        doc,
        "cd /var/www/igor/bots/klinkerpro-bot\n"
        "curl -s http://127.0.0.1:3001/health   # после npm start или pm2\n\n"
        "pm2 start src/index.js --name klinkerpro\n"
        "pm2 save\n"
        "pm2 list",
    )

    # Section 8 - Nginx
    add_heading(doc, "8. Nginx: конфигурации для обоих ботов", 1)
    add_para(
        doc,
        "Замените boat-bot.example.ru и klinker-bot.example.ru на ваши реальные имена.",
    )

    add_heading(doc, "8.1. Boat Sochi", 2)
    add_code(
        doc,
        "cat > /etc/nginx/sites-available/boat-bot << 'EOF'\n"
        "server {\n"
        "    listen 80;\n"
        "    server_name boat-bot.example.ru;\n\n"
        "    location / {\n"
        "        proxy_pass http://127.0.0.1:3000;\n"
        "        proxy_http_version 1.1;\n"
        "        proxy_set_header Host $host;\n"
        "        proxy_set_header X-Real-IP $remote_addr;\n"
        "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
        "        proxy_set_header X-Forwarded-Proto $scheme;\n"
        "        proxy_read_timeout 120s;\n"
        "    }\n"
        "}\n"
        "EOF\n\n"
        "ln -sf /etc/nginx/sites-available/boat-bot /etc/nginx/sites-enabled/\n"
        "nginx -t && systemctl reload nginx",
    )

    add_heading(doc, "8.2. KlinkerPro", 2)
    add_code(
        doc,
        "cat > /etc/nginx/sites-available/klinker-bot << 'EOF'\n"
        "server {\n"
        "    listen 80;\n"
        "    server_name klinker-bot.example.ru;\n\n"
        "    location / {\n"
        "        proxy_pass http://127.0.0.1:3001;\n"
        "        proxy_http_version 1.1;\n"
        "        proxy_set_header Host $host;\n"
        "        proxy_set_header X-Real-IP $remote_addr;\n"
        "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
        "        proxy_set_header X-Forwarded-Proto $scheme;\n"
        "        proxy_read_timeout 120s;\n"
        "    }\n"
        "}\n"
        "EOF\n\n"
        "ln -sf /etc/nginx/sites-available/klinker-bot /etc/nginx/sites-enabled/\n"
        "nginx -t && systemctl reload nginx",
    )

    add_para(doc, "Удалите дефолтный сайт nginx, если мешает:")
    add_code(doc, "rm -f /etc/nginx/sites-enabled/default\nnginx -t && systemctl reload nginx")

    # Section 9 - SSL
    add_heading(doc, "9. SSL-сертификаты (Let's Encrypt)", 1)
    add_para(doc, "DNS должен уже указывать на VPS. Выпуск сертификатов:")
    add_code(
        doc,
        "certbot --nginx -d boat-bot.example.ru\n"
        "certbot --nginx -d klinker-bot.example.ru\n"
        "# для webtaxi2.ru:\n"
        "# certbot --nginx -d boat.webtaxi2.ru -d klinker.webtaxi2.ru",
    )
    add_para(doc, "Автопродление:")
    add_code(doc, "certbot renew --dry-run\nsystemctl status certbot.timer")

    # Section 10 - Tilda
    add_heading(doc, "10. Обновление виджетов на Tilda", 1)
    add_para(
        doc,
        "Если меняли домены (вариант A), обновите скрипт embed.js на обоих сайтах. "
        "Если оставили webtaxi2.ru (вариант B) — этот шаг можно пропустить.",
    )

    add_heading(doc, "10.1. boat-sochi.ru", 2)
    add_para(doc, "Tilda → Настройки сайта → HTML-код перед </body>:")
    add_code(doc, '<script src="https://boat-bot.example.ru/embed.js"></script>')
    add_para(doc, "Опубликуйте сайт. Проверьте чат на любой странице boat-sochi.ru.")

    add_heading(doc, "10.2. marmara-pro.ru", 2)
    add_code(doc, '<script src="https://klinker-bot.example.ru/embed.js"></script>')
    add_para(doc, "Страница каталога: https://marmara-pro.ru/termo — кнопка чата в углу.")

    add_para(
        doc,
        "Telegram и MAX на Beget не подключаем — отдельный webhook и npm run max:chat-id не нужны.",
    )

    # Section 11 - Cron
    add_heading(doc, "11. Cron (опционально, без MAX)", 1)
    add_para(
        doc,
        "Cron не обязателен. Если нужен простой мониторинг без уведомлений в MAX — health:ping "
        "без флага --notify. Скрипты check:avito, remind:bookings, max:chat-id не используем.",
    )
    add_code(doc, "crontab -e -u deploy")
    add_code(
        doc,
        "# опционально — только запись в лог, без MAX:\n"
        "*/15 * * * * cd /var/www/boat-sochi-bot && npm run health:ping >> /var/log/boat-health.log 2>&1",
    )

    # Section 12 - Cutover
    add_heading(doc, "12. План переключения (cutover) со старого VPS", 1)
    add_para(doc, "Рекомендуемый порядок — минимум простоя:")
    add_bullet(doc, "Шаг 0. Beget: разделы 4–5; git clone + npm install (6–7); scp только .env (1.6).")
    add_bullet(doc, "Шаг 1. На Beget поднять nginx + pm2, проверить curl http://127.0.0.1:3000/health локально.")
    add_bullet(doc, "Шаг 2. Временно прописать в /etc/hosts на своём ПК новый IP для теста домена.")
    add_bullet(doc, "Шаг 3. Проверить чат на Tilda (локально через hosts) или временный поддомен.")
    add_bullet(doc, "Шаг 4. Сменить A-записи DNS (или обновить Tilda, если новые домены).")
    add_bullet(doc, "Шаг 5. pm2 restart all на новом VPS; curl health снаружи.")
    add_bullet(doc, "Шаг 6. Обновить embed.js на Tilda и опубликовать.")
    add_bullet(doc, "Шаг 7. 24–48 часов понаблюдать логи: pm2 logs, journalctl.")
    add_bullet(doc, "Шаг 8. Остановить боты на старом VPS: pm2 stop all; отключить автозапуск.")
    add_bullet(doc, "Шаг 9. Через неделю — отменить старый VPS у прежнего хостера.")

    add_heading(doc, "12.1. Бэкап перед миграцией", 2)
    add_code(
        doc,
        "# С REG.RU сохраняем только секреты и (если нужно) локальный knowledge — без логов:\n"
        "# из boat.env на ПК переносим на Beget только YANDEX_* (+ PUBLIC_URL, PORT)\n"
        "scp root@СТАРЫЙ_IP_REGRU:/var/www/boat-sochi-bot/.env ./backup/boat.env\n"
        "scp root@СТАРЫЙ_IP_REGRU:/var/www/igor/bots/klinkerpro-bot/.env ./backup/klinker.env\n"
        "# опционально, если правки не в Git:\n"
        "scp -r root@СТАРЫЙ_IP_REGRU:/var/www/boat-sochi-bot/knowledge ./backup/boat-knowledge",
    )
    add_para(
        doc,
        "После успешной миграции: REG.RU → VPS → остановить сервисы (pm2 stop all) и позже удалить/не продлевать тариф.",
    )

    # Section 13 - Verification
    add_heading(doc, "13. Проверка после миграции", 1)
    add_table(
        doc,
        ["Проверка", "Команда / действие", "Ожидание"],
        [
            ["Boat health", "curl -s https://boat-bot.example.ru/health", "JSON, ai: yandex или openai"],
            ["Klinker health", "curl -s https://klinker-bot.example.ru/health", "JSON, ai настроен"],
            ["Boat embed", "curl -sI https://boat-bot.example.ru/embed.js | head -3", "HTTP/2 200"],
            ["Klinker embed", "curl -sI https://klinker-bot.example.ru/embed.js | head -3", "HTTP/2 200"],
            ["Boat чат", "Вопрос на boat-sochi.ru", "Ответ про яхты/катера"],
            ["Klinker чат", "Вопрос на marmara-pro.ru/termo", "Ответ про термопанели"],
            ["Boat в виджете", "«Хочу забронировать» + телефон", "Ответ в чате на сайте (MAX не шлём)"],
            ["pm2", "pm2 list", "boat-sochi и klinkerpro online"],
        ],
    )

    add_heading(doc, "13.1. Обновление кода в будущем", 2)
    add_para(doc, "Boat:")
    add_code(
        doc,
        "cd /var/www/boat-sochi-bot\n"
        "git fetch origin cursor/boat-contact-route-5814\n"
        "git pull origin cursor/boat-contact-route-5814\n"
        "pm2 restart boat-sochi\n"
        "curl -s https://boat-bot.example.ru/health",
    )
    add_para(doc, "Klinker:")
    add_code(
        doc,
        "cd /var/www/igor\n"
        "bash bots/klinkerpro-bot/scripts/deploy-knowledge.sh\n"
        "# или вручную:\n"
        "git pull origin cursor/termopaneli-bot-bfbc\n"
        "pm2 restart klinkerpro",
    )

    # Section 14 - Troubleshooting
    add_heading(doc, "14. Частые проблемы", 1)
    add_table(
        doc,
        ["Симптом", "Причина", "Решение"],
        [
            ["502 Bad Gateway", "Node не запущен или неверный порт", "pm2 list; systemctl status; nginx proxy_pass"],
            ["ai: none в health", "Нет Yandex ключей", "Проверить .env, перезапустить pm2"],
            ["Виджет не появляется", "Старый URL в Tilda или не опубликовано", "F12 → Network → embed.js"],
            ["SSL ошибка", "DNS ещё не обновился", "dig +short; подождать; certbot снова"],
            ["В логах MAX/Telegram", "В .env остались токены", "Очистить MAX_* и TELEGRAM_*; pm2 restart"],
            ["CORS / чат молчит", "HTTP вместо HTTPS на сайте", "Tilda только HTTPS"],
            ["Порт занят", "Два процесса на 3000/3001", "ss -tlnp | grep 300"],
            ["Knowledge устарел", "На REG.RU правили без git push", "scp только knowledge/ или закоммитить в GitHub"],
            ["Сайт открывает старый VPS", "DNS не обновился", "dig +short boat.webtaxi2.ru; сменить A на Beget"],
        ],
    )

    # Section 15 - Links
    add_heading(doc, "15. Полезные ссылки", 1)
    links = [
        ("Репозиторий Igor", "https://github.com/Igor-Lark/Igor"),
        ("Ветка boat", "https://github.com/Igor-Lark/Igor/tree/cursor/boat-contact-route-5814"),
        ("PR boat", "https://github.com/Igor-Lark/Igor/pull/17"),
        ("Ветка klinker", "https://github.com/Igor-Lark/Igor/tree/cursor/termopaneli-bot-bfbc"),
        ("DEPLOY klinker (markdown)", "https://github.com/Igor-Lark/Igor/blob/cursor/termopaneli-bot-bfbc/bots/klinkerpro-bot/DEPLOY.md"),
        ("Сайт boat-sochi.ru", "https://boat-sochi.ru"),
        ("Сайт marmara-pro.ru/termo", "https://marmara-pro.ru/termo"),
        ("Yandex Cloud", "https://console.cloud.yandex.ru"),
        ("Beget VPS", "https://beget.com/ru/vps"),
        ("REG.RU — VPS и DNS", "https://www.reg.ru/user/account/"),
        ("Текущий boat (REG.RU VPS)", "https://boat.webtaxi2.ru/health"),
        ("Текущий klinker (REG.RU VPS)", "https://klinker.webtaxi2.ru/health"),
    ]
    for name, url in links:
        p = doc.add_paragraph()
        r1 = p.add_run(f"{name}: ")
        r1.bold = True
        r2 = p.add_run(url)
        r2.font.color.rgb = RGBColor(0x05, 0x63, 0xC1)

    doc.add_paragraph()
    add_para(
        doc,
        "При выборе поддоменов на Beget напишите, какой домен используете — "
        "можно сразу подставить готовые A-записи и nginx-конфиги под ваши имена.",
        italic=True,
    )

    doc.save(OUT)
    print(f"Saved: {OUT}")


if __name__ == "__main__":
    build()

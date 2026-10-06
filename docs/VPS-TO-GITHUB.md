# VPS REG.RU → GitHub (boat)

Перед переездом на Beget всё нужное для бота должно лежать в Git, а не только на VPS.

## Единственная рабочая ветка boat

| Ветка | Назначение |
|-------|------------|
| **`cursor/boat-contact-route-5814`** | Виджет Tilda + YandexGPT + `knowledge/` |

Ветки мессенджеров **удалены с GitHub** (MAX/Telegram не деплоим):

- ~~`cursor/boat-sochi-max-5814`~~  
- ~~`cursor/boat-sochi-bot-5814`~~ / telegram  

Klinker: ветка **`cursor/termopaneli-bot-bfbc`**, каталог `bots/klinkerpro-bot/`.

## Что забрать с VPS

| С VPS | В репозиторий |
|-------|----------------|
| `knowledge/*` | `knowledge/` |
| `public/embed.js` (если меняли на сервере) | `public/embed.js` |
| `.env` | **не в Git** — только на Beget вручную (YandexGPT) |

Не копировать: `node_modules/`, `~/.pm2/logs`, `/var/log`, архивы.

## Чистый старт на VPS (удалить все логи)

```bash
cd /var/www/boat-sochi-bot   # или ~/Igor после git pull
git pull origin cursor/boat-contact-route-5814
bash scripts/vps-clean-logs-and-restart.sh
```

Скрипт: pm2, логи pm2/npm/journald, `*.log` в `/var/log` и `/var/www`; затем запуск boat + klinker. **`.env` и `knowledge/` не удаляются.**

## Пуш прямо с VPS (`~/Igor`)

Ошибка `src refspec cursor/boat-contact-route-5814 does not match any` значит: **локально этой ветки нет** (вы на `main` или другой ветке). Сначала создайте её от origin:

```bash
cd ~/Igor
git fetch origin
git switch -c cursor/boat-contact-route-5814 origin/cursor/boat-contact-route-5814
git branch --show-current   # должно быть cursor/boat-contact-route-5814
```

Боевой бот часто в **`/var/www/boat-sochi-bot`**, а клон — в **`~/Igor`**. Тогда скопируйте knowledge в клон и запушьте:

```bash
cd ~/Igor
git switch cursor/boat-contact-route-5814
git pull origin cursor/boat-contact-route-5814
rsync -a /var/www/boat-sochi-bot/knowledge/ ./knowledge/
cp -f /var/www/boat-sochi-bot/public/embed.js ./public/embed.js 2>/dev/null || true
git add knowledge public/embed.js
git status
git commit -m "sync: knowledge с /var/www/boat-sochi-bot"
git push -u origin cursor/boat-contact-route-5814
```

**`nothing to commit`** — файлы уже как в GitHub; push всё равно не нужен, если нечего менять.

**Один скрипт на VPS:**

```bash
cd ~/Igor
git pull origin cursor/boat-contact-route-5814 2>/dev/null || git fetch origin
bash scripts/vps-commit-boat-to-github.sh
```

Если `git push` просит пароль: на VPS для GitHub нужен **Personal Access Token** (не пароль аккаунта) или **SSH**:

```bash
git remote set-url origin git@github.com:Igor-Lark/Igor.git
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub   # добавить в GitHub → Settings → SSH keys
git push -u origin cursor/boat-contact-route-5814
```

## Скрипт с вашего ПК (rsync по SSH)

```bash
git checkout cursor/boat-contact-route-5814
export VPS=root@ВАШ_IP_REGRU
bash scripts/sync-from-vps-to-git.sh
git add knowledge public/embed.js
git commit -m "sync: knowledge с VPS REG.RU"
git push origin cursor/boat-contact-route-5814
```

## Klinker (отдельная ветка)

```bash
git checkout cursor/termopaneli-bot-bfbc
export VPS=root@ВАШ_IP_REGRU
rsync -avz --delete "$VPS:/var/www/igor/bots/klinkerpro-bot/knowledge/" bots/klinkerpro-bot/knowledge/
# или путь ~/igor/bots/klinkerpro-bot на VPS
git add bots/klinkerpro-bot/knowledge
git commit -m "sync: klinker knowledge с VPS"
git push origin cursor/termopaneli-bot-bfbc
```

Полная инструкция по Beget: [beget-migration-boat-klinker.docx](beget-migration-boat-klinker.docx) (ветка `cursor/beget-migration-5814`).

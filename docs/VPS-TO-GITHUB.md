# VPS REG.RU → GitHub (boat)

Перед переездом на Beget всё нужное для бота должно лежать в Git, а не только на VPS.

## Единственная рабочая ветка boat

| Ветка | Назначение |
|-------|------------|
| **`cursor/boat-contact-route-5814`** | Виджет Tilda + YandexGPT + `knowledge/` |

Ветки мессенджеров (**удалены**, не использовать):

- ~~`cursor/boat-sochi-max-5814`~~ — MAX  
- ~~`cursor/boat-sochi-bot-5814`~~ / telegram — Telegram  

Klinker: ветка **`cursor/termopaneli-bot-bfbc`**, каталог `bots/klinkerpro-bot/`.

## Что забрать с VPS

| С VPS | В репозиторий |
|-------|----------------|
| `knowledge/*` | `knowledge/` |
| `public/embed.js` (если меняли на сервере) | `public/embed.js` |
| `.env` | **не в Git** — только на Beget вручную (YandexGPT) |

Не копировать: `node_modules/`, `~/.pm2/logs`, `/var/log`, архивы.

## Скрипт (с вашего ПК)

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

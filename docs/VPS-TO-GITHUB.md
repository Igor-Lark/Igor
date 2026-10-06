# VPS REG.RU → GitHub (boat + klinker)

Источник правды для деплоя на **Beget** — GitHub, не старый VPS.

## Ветки

| Бот | Ветка | Путь |
|-----|--------|------|
| Boat Sochi | `cursor/boat-contact-route-5814` | корень репозитория на этой ветке |
| KlinkerPro | `cursor/termopaneli-bot-bfbc` | `bots/klinkerpro-bot/` |

Ветки **MAX / Telegram для boat удалены** (`cursor/boat-sochi-max-5814` и др.). Не восстанавливать.

## Boat — sync с VPS

```bash
git checkout cursor/boat-contact-route-5814
export VPS=root@IP_REGRU
bash scripts/sync-from-vps-to-git.sh
git add knowledge public/embed.js
git commit -m "sync: boat knowledge с VPS"
git push origin cursor/boat-contact-route-5814
```

## Klinker — sync с VPS

```bash
git checkout cursor/termopaneli-bot-bfbc
export VPS=root@IP_REGRU
bash bots/klinkerpro-bot/scripts/sync-knowledge-from-vps.sh
git add bots/klinkerpro-bot/knowledge bots/klinkerpro-bot/public/embed.js
git commit -m "sync: klinker knowledge с VPS"
git push origin cursor/termopaneli-bot-bfbc
```

`.env` в Git **не коммитить** — на Beget только YandexGPT.

Инструкция Beget (Word): ветка `cursor/beget-migration-5814`, файл `docs/beget-migration-boat-klinker.docx`.

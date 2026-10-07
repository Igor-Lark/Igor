#!/usr/bin/env bash
# Удалить логи старше 10 дней (boat, klinker, pm2, journald, чаты).
# Cron:  15 4 * * * /var/www/boat-sochi-bot/scripts/vps-prune-logs.sh
set -euo pipefail
DAYS="${LOG_KEEP_DAYS:-10}"

find /root/.pm2/logs -type f -mtime +"$DAYS" -delete 2>/dev/null || true
find /var/log -type f \( -name '*.log' -o -name '*.gz' -o -name '*.old' -o -name '*.1' \) -mtime +"$DAYS" -delete 2>/dev/null || true
find /var/www -path '*/node_modules/*' -prune -o -type f -name '*.log' -mtime +"$DAYS" -print -delete 2>/dev/null || true
find /var/www/boat-sochi-bot/data/chats -maxdepth 1 -type f -name '*.jsonl' -mtime +"$DAYS" -delete 2>/dev/null || true
find /var/www/boat-sochi-bot/data/chats/sessions -type f -mtime +"$DAYS" -delete 2>/dev/null || true
journalctl --vacuum-time="${DAYS}d" >/dev/null 2>&1 || true

echo "$(date -Iseconds) pruned logs older than ${DAYS} days"

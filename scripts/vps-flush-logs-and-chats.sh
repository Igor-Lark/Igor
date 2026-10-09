#!/usr/bin/env bash
# Сейчас: обнулить логи и диалоги, ботов НЕ останавливать.
# Не трогает: .env, knowledge/, исходники, pm2-процессы.
#
#   bash /var/www/boat-sochi-bot/scripts/vps-flush-logs-and-chats.sh

set -euo pipefail

BOAT="/var/www/boat-sochi-bot"
KLINKER="/var/www/igor-klinker/bots/klinkerpro-bot"

echo "=== Диск до ==="
df -h / | tail -1

echo "=== Логи pm2 (процессы остаются online) ==="
pm2 flush || true
rm -f /root/.pm2/pm2.log /root/.pm2/agent.log 2>/dev/null || true
find /root/.pm2/logs -type f -name '*.log' -exec truncate -s 0 {} \; 2>/dev/null || true

echo "=== journald ==="
journalctl --vacuum-size=50M >/dev/null 2>&1 || true

echo "=== *.log в /var/www (не node_modules) ==="
find /var/www -path '*/node_modules/*' -prune -o -type f -name '*.log' -print -delete 2>/dev/null || true

wipe_bot_runtime() {
  local dir="$1"
  local name="$2"
  if [[ ! -d "$dir" ]]; then
    echo "SKIP $name: нет $dir"
    return
  fi
  echo "=== Диалоги/runtime: $name ($dir) ==="
  mkdir -p "$dir/data/chats/sessions" "$dir/data/no-contact"
  find "$dir/data/chats" -maxdepth 1 -type f -name '*.jsonl' -delete 2>/dev/null || true
  find "$dir/data/chats/sessions" -type f -name '*.json' -delete 2>/dev/null || true
  printf '%s\n' '{}' > "$dir/data/no-contact/active.json"
  rm -f "$dir/data/ai-alert-state.json" 2>/dev/null || true
  rm -f "$dir/data/avito-reviews-state.json" 2>/dev/null || true
}

wipe_bot_runtime "$BOAT" "boat"
wipe_bot_runtime "$KLINKER" "klinker"

echo "=== Диск после ==="
df -h / | tail -1

echo "=== Проверка ботов ==="
curl -sS -m 5 http://127.0.0.1:3000/health || echo "boat:3000 — нет ответа"
echo
curl -sS -m 5 http://127.0.0.1:3001/health || echo "klinker:3001 — нет ответа"
echo
pm2 status

echo "Готово. .env и knowledge не трогали, pm2 не перезапускали."

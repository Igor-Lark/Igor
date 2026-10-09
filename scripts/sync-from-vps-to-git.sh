#!/usr/bin/env bash
# Скачать с VPS REG.RU только код обучения и статику виджета (без логов, .env, node_modules).
# Запуск с вашего ПК, где есть SSH на старый VPS:
#
#   export VPS=root@IP_REGRU
#   ./scripts/sync-from-vps-to-git.sh
#
# Затем: git diff, git commit, git push origin cursor/boat-contact-route-5814

set -euo pipefail

VPS="${VPS:?Укажите VPS=root@IP_REGRU}"
REMOTE_BOAT="${REMOTE_BOAT:-/var/www/boat-sochi-bot}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ knowledge/ с $VPS:$REMOTE_BOAT"
rsync -avz --delete \
  --exclude '*.log' \
  "$VPS:$REMOTE_BOAT/knowledge/" "$ROOT/knowledge/"

if ssh "$VPS" "test -f $REMOTE_BOAT/public/embed.js"; then
  echo "→ public/embed.js"
  rsync -avz "$VPS:$REMOTE_BOAT/public/embed.js" "$ROOT/public/embed.js"
fi

echo "Готово. Проверьте: git status && git diff"

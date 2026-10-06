#!/usr/bin/env bash
# knowledge/ с VPS REG.RU → Git (ветка cursor/termopaneli-bot-bfbc).
#   export VPS=root@IP_REGRU
#   bash bots/klinkerpro-bot/scripts/sync-knowledge-from-vps.sh

set -euo pipefail

VPS="${VPS:?Укажите VPS=root@IP_REGRU}"
REMOTE="${REMOTE_KLINKER:-/var/www/igor/bots/klinkerpro-bot}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for try in "$REMOTE" "/root/igor/bots/klinkerpro-bot" "/home/deploy/igor/bots/klinkerpro-bot"; do
  if ssh "$VPS" "test -d $try/knowledge"; then
    REMOTE="$try"
    break
  fi
done

echo "→ $VPS:$REMOTE/knowledge/ → $ROOT/knowledge/"
rsync -avz --delete --exclude '*.log' "$VPS:$REMOTE/knowledge/" "$ROOT/knowledge/"

if ssh "$VPS" "test -f $REMOTE/public/embed.js"; then
  rsync -avz "$VPS:$REMOTE/public/embed.js" "$ROOT/public/embed.js"
fi

echo "Готово: git status в корне репозитория (ветка termopaneli-bot-bfbc)"

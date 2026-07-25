#!/usr/bin/env bash
# Копия SEO-файлов на VPS (рядом с ботом). Запускать на своём ПК или на VPS после git pull.
#
# Использование:
#   VPS=root@cv7670849 REMOTE=/var/www/igor-klinker ./deploy-to-vps.sh
#   ./deploy-to-vps.sh --local-only   # только проверка путей без rsync
#
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"
VPS="${VPS:-root@cv7670849}"
REMOTE="${REMOTE:-/var/www/igor-klinker}"
LOCAL_ONLY=0
[[ "${1:-}" == "--local-only" ]] && LOCAL_ONLY=1

DEST="$REMOTE/sites/marmara-pro"
echo "Repo: $REPO_ROOT"
echo "Target: $VPS:$DEST"

if [[ "$LOCAL_ONLY" -eq 1 ]]; then
  echo "Files to sync:"
  ls -la "$DIR"
  exit 0
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync not found" >&2
  exit 1
fi

ssh "$VPS" "mkdir -p '$DEST'"
rsync -avz \
  "$DIR/" \
  "$VPS:$DEST/" \
  --exclude 'deploy-to-vps.sh'

# База бота (site-home, site-termo, faq)
BOT_KNOW="$REMOTE/bots/klinkerpro-bot/knowledge"
ssh "$VPS" "mkdir -p '$BOT_KNOW'"
rsync -avz \
  "$REPO_ROOT/bots/klinkerpro-bot/knowledge/site-home.md" \
  "$REPO_ROOT/bots/klinkerpro-bot/knowledge/site-termo.md" \
  "$REPO_ROOT/bots/klinkerpro-bot/knowledge/faq.md" \
  "$VPS:$BOT_KNOW/"

echo ""
echo "On VPS:"
echo "  cd $REMOTE && git pull   # предпочтительно вместо rsync"
echo "  pm2 restart klinkerpro   # подхватить knowledge/*.md"
echo "  ls -la $DEST"

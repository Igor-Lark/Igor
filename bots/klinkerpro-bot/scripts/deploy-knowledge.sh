#!/usr/bin/env bash
# Обновление базы знаний и промпта бота на VPS (без микроразметки сайта).
# Запускать **на VPS** в каталоге репозитория.
#
#   cd /var/www/igor-klinker   # ваш путь
#   bash bots/klinkerpro-bot/scripts/deploy-knowledge.sh
#
set -euo pipefail
BRANCH="${BRANCH:-cursor/termopaneli-bot-bfbc}"
BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$BOT_DIR/../.." && pwd)"

cd "$REPO_ROOT"
echo "Repo: $REPO_ROOT"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo ""
echo "Knowledge files:"
ls -la "$BOT_DIR/knowledge/site-home.md" "$BOT_DIR/knowledge/site-termo.md" "$BOT_DIR/knowledge/faq.md" 2>/dev/null || ls -la "$BOT_DIR/knowledge/"

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart klinkerpro
  echo "pm2: klinkerpro restarted"
else
  echo "pm2 not found — перезапустите процесс бота вручную"
fi

curl -sf "http://127.0.0.1:${PORT:-3001}/health" | head -c 200 || true
echo ""
echo "Done. Виджет embed.js обновляется отдельно (Tilda / CDN), не через этот скрипт."

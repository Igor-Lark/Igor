#!/usr/bin/env bash
# Обновление базы знаний и промпта бота на VPS (без микроразметки сайта).
# Запускать **на VPS** в каталоге репозитория.
#
#   cd /var/www/igor-klinker
#   bash bots/klinkerpro-bot/scripts/deploy-knowledge.sh
#
set -euo pipefail
BRANCH="${BRANCH:-cursor/facade-openings-calc-bfbc}"
BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$BOT_DIR/../.." && pwd)"

cd "$REPO_ROOT"
echo "Repo: $REPO_ROOT"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "Git: $(git rev-parse --short HEAD) (branch: $(git branch --show-current))"

if ! grep -q 'FACADE_CALC_VERSION' "$BOT_DIR/src/facade-calc.js"; then
  echo "ERROR: в $BOT_DIR нет FACADE_CALC_VERSION — ветка не та или pull не прошёл"
  exit 1
fi

echo ""
echo "Knowledge files:"
ls -la "$BOT_DIR/knowledge/site-home.md" "$BOT_DIR/knowledge/faq.md" 2>/dev/null | tail -5 || ls -la "$BOT_DIR/knowledge/"

cd "$BOT_DIR"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe klinkerpro >/dev/null 2>&1; then
    pm2 delete klinkerpro || true
  fi
  pm2 start ecosystem.config.cjs --update-env
  pm2 save 2>/dev/null || true
  echo "pm2: klinkerpro started from $BOT_DIR"
  pm2 describe klinkerpro | egrep 'exec cwd|script path|status' || true
else
  echo "pm2 not found — вручную: cd $BOT_DIR && node src/index.js"
fi

sleep 2
HEALTH=$(curl -sf "http://127.0.0.1:${PORT:-3001}/health" || true)
echo ""
echo "$HEALTH"
echo ""
if echo "$HEALTH" | grep -qE '"facadeCalcVersion":(5|6)'; then
  echo "OK: facadeCalcVersion в health"
else
  echo "WARN: нет facadeCalcVersion 5/6 — проверьте pull и pm2"
  exit 1
fi

bash "$BOT_DIR/scripts/verify-facade-calc.sh" "http://127.0.0.1:${PORT:-3001}" || exit 1

echo "Done. Виджет embed.js на Tilda — отдельно (https://klinker.webtaxi2.ru/embed.js)."

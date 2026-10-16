#!/usr/bin/env bash
# Принудительно поставить расчёт v9 на VPS. Не использует старый deploy-knowledge.sh.
#   bash bots/klinkerpro-bot/scripts/force-v9-on-vps.sh
set -euo pipefail
REPO="${REPO:-/var/www/igor-klinker}"
BRANCH="cursor/klinker-kb-site-bfbc"
BOT="$REPO/bots/klinkerpro-bot"

cd "$REPO"
echo "=== before ==="
echo "branch=$(git branch --show-current || true) sha=$(git rev-parse --short HEAD 2>/dev/null || true)"
echo "file=$(grep -oE 'FACADE_CALC_VERSION = [0-9]+' "$BOT/src/facade-calc.js" 2>/dev/null | head -1 || echo missing)"

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

echo "=== after checkout ==="
echo "branch=$(git branch --show-current) sha=$(git rev-parse --short HEAD)"
FILE_VER="$(grep -oE 'FACADE_CALC_VERSION = [0-9]+' "$BOT/src/facade-calc.js" | head -1)"
echo "file=$FILE_VER"
if [[ "$FILE_VER" != "FACADE_CALC_VERSION = 9" ]]; then
  echo "ERROR: после checkout файл не v9"
  exit 1
fi

cd "$BOT"
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete klinkerpro 2>/dev/null || true
  pm2 start "$BOT/ecosystem.config.cjs" --update-env
  pm2 save 2>/dev/null || true
  echo "=== pm2 ==="
  pm2 describe klinkerpro | egrep 'exec cwd|script path|status' || true
else
  echo "pm2 нет — запускаю node на 3001 в фоне не буду, запустите сами"
  exit 1
fi

sleep 2
echo "=== localhost ==="
curl -sS "http://127.0.0.1:3001/health" || true
echo
echo "=== public ==="
curl -sS "https://klinker.webtaxi2.ru/health" || true
echo

LOCAL_VER="$(curl -sS http://127.0.0.1:3001/health | grep -oE 'facadeCalcVersion":[0-9]+' || true)"
if [[ "$LOCAL_VER" != 'facadeCalcVersion":9' ]]; then
  echo "ERROR: localhost не v9 ($LOCAL_VER). Смотрите exec cwd выше."
  exit 1
fi
echo "OK: localhost v9"

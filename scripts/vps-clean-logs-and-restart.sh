#!/usr/bin/env bash
# Полная очистка логов на VPS и перезапуск boat + klinker (REG.RU).
# Не трогает: .env, knowledge/, исходники.
#
#   bash scripts/vps-clean-logs-and-restart.sh

set -euo pipefail

echo "=== Диск до очистки ==="
df -h /

echo "=== Остановка pm2 ==="
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true

echo "=== Логи pm2 ==="
rm -rf /root/.pm2/logs/* 2>/dev/null || true
rm -f /root/.pm2/pm2.log /root/.pm2/agent.log 2>/dev/null || true

echo "=== npm-кэш ==="
npm cache clean --force 2>/dev/null || true
rm -rf /root/.npm/_cacache /root/.npm/_logs 2>/dev/null || true

echo "=== journald (системные логи) ==="
journalctl --vacuum-size=50M 2>/dev/null || true

echo "=== /var/log (файлы *.log, *.gz, *.1) ==="
find /var/log -type f \( -name '*.log' -o -name '*.gz' -o -name '*.1' -o -name '*.old' \) -delete 2>/dev/null || true

echo "=== Логи в каталогах ботов (если есть) ==="
find /var/www -type f -name '*.log' -delete 2>/dev/null || true
find /var/www -path '*/node_modules/*' -prune -o -type f -name 'npm-debug.log*' -print -delete 2>/dev/null || true

echo "=== apt ==="
apt clean 2>/dev/null || true

echo "=== git lock (если был ENOSPC) ==="
rm -f /var/www/boat-sochi-bot/.git/index.lock
rm -f /var/www/igor/.git/index.lock 2>/dev/null || true

echo "=== Диск после очистки ==="
df -h /

BOAT="/var/www/boat-sochi-bot"
KLINKER="/var/www/igor-klinker/bots/klinkerpro-bot"
[[ -d "$KLINKER" ]] || KLINKER="/var/www/igor/bots/klinkerpro-bot"
[[ -d "$KLINKER" ]] || KLINKER="$HOME/igor/bots/klinkerpro-bot"

if [[ -f "$BOAT/src/index.js" ]]; then
  echo "=== Запуск boat-sochi ==="
  cd "$BOAT"
  pm2 start src/index.js --name boat-sochi
else
  echo "WARN: не найден $BOAT/src/index.js"
fi

if [[ -f "$KLINKER/src/index.js" ]]; then
  echo "=== Запуск klinkerpro ==="
  cd "$KLINKER"
  pm2 start src/index.js --name klinkerpro
else
  echo "WARN: не найден klinker (ожидался $KLINKER)"
fi

pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo "=== Проверка ==="
sleep 2
curl -s http://127.0.0.1:3000/health || echo "boat:3000 — нет ответа"
curl -s http://127.0.0.1:3001/health || echo "klinker:3001 — нет ответа"
pm2 list

echo "=== Логи только ошибок (pm2-logrotate) ==="
pm2 install pm2-logrotate 2>/dev/null || true
pm2 set pm2-logrotate:max_size 10M 2>/dev/null || true
pm2 set pm2-logrotate:retain 2 2>/dev/null || true

echo "Готово. Снаружи: curl -sI https://boat.webtaxi2.ru/embed.js | head -3"

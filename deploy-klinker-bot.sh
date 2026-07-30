#!/usr/bin/env bash
# Запуск на VPS из корня клона репозитория Igor:
#   cd /var/www/igor-klinker && bash deploy-klinker-bot.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$ROOT/bots/klinkerpro-bot/scripts/deploy-knowledge.sh"
if [[ ! -f "$SCRIPT" ]]; then
  echo "Не найден: $SCRIPT"
  echo "Вы не в каталоге репозитория Igor. Обычно:"
  echo "  cd /var/www/igor-klinker"
  echo "  bash deploy-klinker-bot.sh"
  exit 1
fi
exec bash "$SCRIPT" "$@"

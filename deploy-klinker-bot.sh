#!/usr/bin/env bash
# Сначала тянет ветку v9, потом запускает deploy-knowledge.sh.
# Иначе на VPS остаётся старый скрипт и health навсегда v8.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BRANCH="${BRANCH:-cursor/klinker-kb-site-bfbc}"
cd "$ROOT"
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
SCRIPT="$ROOT/bots/klinkerpro-bot/scripts/deploy-knowledge.sh"
if [[ ! -f "$SCRIPT" ]]; then
  echo "Не найден: $SCRIPT"
  exit 1
fi
exec bash "$SCRIPT" "$@"

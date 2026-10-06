#!/usr/bin/env bash
# Запуск на VPS REG.RU из каталога клона GitHub (~/Igor).
# Подтягивает ветку deploy, копирует knowledge с боевого каталога, коммит, push.
#
#   cd ~/Igor
#   bash scripts/vps-commit-boat-to-github.sh
#
# Push в GitHub: нужен доступ (SSH-ключ на github.com или PAT для HTTPS).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

BRANCH="cursor/boat-contact-route-5814"
PROD="${PROD_BOAT:-/var/www/boat-sochi-bot}"

echo "=== git fetch ==="
git fetch origin "$BRANCH" main 2>/dev/null || git fetch origin

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git switch "$BRANCH"
else
  if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    git switch -c "$BRANCH" "origin/$BRANCH"
  else
    echo "Ошибка: на origin нет ветки $BRANCH. Проверьте: git remote -v && git fetch origin"
    exit 1
  fi
fi

git pull origin "$BRANCH" || true

if [[ -d "$PROD/knowledge" ]]; then
  echo "=== knowledge из $PROD ==="
  mkdir -p knowledge public
  rsync -a --delete "$PROD/knowledge/" "$REPO_ROOT/knowledge/"
  if [[ -f "$PROD/public/embed.js" ]]; then
    cp "$PROD/public/embed.js" "$REPO_ROOT/public/embed.js"
  fi
else
  echo "Каталог $PROD/knowledge не найден — коммитим только то, что уже в ~/Igor"
fi

git add knowledge public/embed.js 2>/dev/null || git add knowledge 2>/dev/null || true

if git diff --staged --quiet; then
  echo "nothing to commit — knowledge на VPS совпадает с Git (или PROD_BOAT неверный)."
  echo "Текущая ветка: $(git branch --show-current)"
  exit 0
fi

git commit -m "sync: boat knowledge с VPS $(hostname -s 2>/dev/null || echo vps)"
echo "=== git push ==="
git push -u origin "$BRANCH"

echo "OK: https://github.com/Igor-Lark/Igor/tree/$BRANCH"

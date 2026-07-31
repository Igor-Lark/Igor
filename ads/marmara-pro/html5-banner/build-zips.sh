#!/usr/bin/env bash
# Сборка ZIP-архивов для загрузки в Яндекс Директ (HTML5-баннеры).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/dist"
rm -rf "$OUT"
mkdir -p "$OUT"

pack() {
  local size="$1"
  local dir="$ROOT/$size"
  local zip="$OUT/klinkerpro-termo-${size}.zip"
  if [[ ! -f "$dir/index.html" ]]; then
    echo "skip $size: no index.html" >&2
    return
  fi
  (cd "$dir" && zip -rq "$zip" index.html img)
  local bytes
  bytes=$(stat -c%s "$zip" 2>/dev/null || stat -f%z "$zip")
  echo "OK $zip ($bytes bytes)"
}

pack 300x250
pack 240x400

echo ""
echo "Готово. Загрузите ZIP из $OUT в кампанию Директа."
echo "Посадочная: https://marmara-pro.ru/termo"

#!/usr/bin/env bash
# Диагностика: почему на /health нет facadeCalcVersion
set -euo pipefail
BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$BOT_DIR/../.." && pwd)"

echo "=== Repo ==="
echo "REPO_ROOT=$REPO_ROOT"
cd "$REPO_ROOT"
git branch --show-current || true
git rev-parse --short HEAD 2>/dev/null || true
git fetch origin cursor/facade-openings-calc-bfbc 2>&1 | tail -3 || true

echo ""
echo "=== facade-calc in working tree ==="
if grep -q 'FACADE_CALC_VERSION' "$BOT_DIR/src/facade-calc.js" 2>/dev/null; then
  grep 'FACADE_CALC_VERSION' "$BOT_DIR/src/facade-calc.js" | head -1
else
  echo "MISSING — нужен: git checkout cursor/facade-openings-calc-bfbc && git pull"
fi

if grep -q 'facadeCalcVersion' "$BOT_DIR/src/index.js" 2>/dev/null; then
  echo "index.js: facadeCalcVersion — OK"
else
  echo "index.js: facadeCalcVersion — MISSING"
fi

echo ""
echo "=== pm2 ==="
if command -v pm2 >/dev/null 2>&1; then
  pm2 describe klinkerpro 2>/dev/null | egrep 'exec cwd|script path|status' || echo "pm2: процесс klinkerpro не найден"
else
  echo "pm2 not installed"
fi

echo ""
echo "=== health localhost:3001 ==="
curl -sf "http://127.0.0.1:3001/health" || echo "curl failed"

echo ""

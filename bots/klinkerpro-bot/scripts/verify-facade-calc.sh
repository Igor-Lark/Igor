#!/usr/bin/env bash
# Быстрая проверка расчёта с проёмами на VPS (после deploy).
set -euo pipefail
BASE="${1:-http://127.0.0.1:3001}"
echo "Health:"
curl -sf "$BASE/health" | python3 -m json.tool 2>/dev/null || curl -sf "$BASE/health"
echo ""
echo "Chat (3×4×5, 2 двери 1,5×2, 3 окна 120×80):"
payload='{"messages":[{"role":"user","content":"сделай расчет дома 3 на 4 на 5, двое дверей полтора на два метра, 3 окна 120 на 80"}]}'
resp=$(curl -sf "$BASE/api/chat" -H 'Content-Type: application/json' -d "$payload")
echo "$resp" | python3 -m json.tool 2>/dev/null | head -40 || echo "$resp" | head -c 1200
echo ""
if echo "$resp" | grep -q '99 шт'; then
  echo "OK: 99 термопанелей (0,62 m², без подрезки, с вычетом проёмов)"
else
  echo "FAIL: ожидалось 99 шт. — проверьте git pull и pm2 restart"
  exit 1
fi
if echo "$resp" | grep -q 'server-calc'; then
  echo "OK: provider server-calc"
else
  echo "WARN: ответ не от server-calc (возможно старый код)"
fi

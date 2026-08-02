#!/usr/bin/env bash
# Быстрая проверка расчёта с проёмами на VPS (после deploy).
set -euo pipefail
BASE="${1:-http://127.0.0.1:3001}"

pretty_json() {
  python3 -c 'import json,sys; json.dump(json.load(sys.stdin), sys.stdout, ensure_ascii=False, indent=2); print()'
}

echo "Health:"
curl -sf "$BASE/health" | pretty_json

echo "Chat (8×4×3, 6 окон 1×0,8, 2 двери 2×0,8):"
payload='{"messages":[{"role":"user","content":"Расчитай 8 на 4 и 3 метра, 6 окон метр на 80 см, 2 двери 2м на 80 см"}]}'
resp=$(curl -sf "$BASE/api/chat" -H 'Content-Type: application/json' -d "$payload")

echo "provider: $(echo "$resp" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("provider",""))')"
echo "--- ответ (текст для клиента) ---"
echo "$resp" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("reply",""))'
echo "---"

if echo "$resp" | grep -q '104 шт'; then
  echo "OK: 104 термопанелей (дом 8×4×3, S_gross=72, с вычетом проёмов)"
else
  echo "FAIL: ожидалось 104 шт. для 8×4×3 — проверьте git pull и pm2 restart"
  exit 1
fi
if echo "$resp" | grep -q '72'; then
  echo "OK: площадь стен 72 кв.м в ответе"
else
  echo "WARN: в ответе нет 72 кв.м (проверьте формулу площади)"
fi

echo ""
echo "Chat (3×4×5, 2 двери 1,5×2, 3 окна 120×80):"
payload='{"messages":[{"role":"user","content":"сделай расчет дома 3 на 4 на 5, двое дверей полтора на два метра, 3 окна 120 на 80"}]}'
resp=$(curl -sf "$BASE/api/chat" -H 'Content-Type: application/json' -d "$payload")

echo "provider: $(echo "$resp" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("provider",""))')"
echo "--- ответ (текст для клиента) ---"
echo "$resp" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("reply",""))'
echo "---"

if echo "$resp" | grep -q '99 шт'; then
  echo "OK: 99 термопанелей (0,62 m², без подрезки, с вычетом проёмов)"
else
  echo "FAIL: ожидалось 99 шт. — проверьте git pull и pm2 restart"
  exit 1
fi
if echo "$resp" | python3 -c 'import json,sys; exit(0 if json.load(sys.stdin).get("provider")== "server-calc" else 1)'; then
  echo "OK: provider server-calc"
else
  echo "WARN: ответ не от server-calc (возможно старый код)"
fi

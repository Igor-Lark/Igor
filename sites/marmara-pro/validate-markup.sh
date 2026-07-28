#!/usr/bin/env bash
# Проверка JSON-LD в sites/marmara-pro/*.html
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
LIVE=0
[[ "${1:-}" == "--live" ]] && LIVE=1

export DIR LIVE
python3 - "$@" << 'PY'
import json, os, re, sys, pathlib, urllib.request

DIR = pathlib.Path(os.environ["DIR"])
LIVE = os.environ.get("LIVE") == "1"
files = ["homepage-microdata.html", "termo-microdata.html"]
ok = True

for name in files:
    p = DIR / name
    t = p.read_text(encoding="utf-8")
    m = re.search(
        r'<script type="application/ld\+json">\s*(\{.*\})\s*</script>', t, re.S
    )
    if not m:
        print(f"FAIL {name}: no JSON-LD block")
        ok = False
        continue
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        print(f"FAIL {name}: JSON {e}")
        ok = False
        continue
    graph = data.get("@graph") or []
    types = []
    for node in graph:
        tpe = node.get("@type")
        if isinstance(tpe, list):
            types.extend(tpe)
        elif tpe:
            types.append(tpe)
    raw = m.group(1)
    if re.search(r"кир[\u0070]ич", raw):
        print(f"WARN {name}: Latin 'p' in «кирpich»")
    print(f"OK  {name}: {len(graph)} nodes — {', '.join(types)}")

if LIVE:
    def load_url(url):
        html = urllib.request.urlopen(url, timeout=30).read().decode(
            "utf-8", errors="replace"
        )
        blocks = re.findall(
            r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            html,
            re.S | re.I,
        )
        if not blocks:
            raise SystemExit(f"No JSON-LD on {url}")
        return json.loads(blocks[0].strip())

    pairs = [
        ("https://marmara-pro.ru/", "homepage-microdata.html"),
        ("https://marmara-pro.ru/termo", "termo-microdata.html"),
    ]
    for url, fname in pairs:
        live = load_url(url)
        repo = json.loads(
            re.search(
                r'<script type="application/ld\+json">\s*(\{.*\})\s*</script>',
                (DIR / fname).read_text(encoding="utf-8"),
                re.S,
            ).group(1)
        )
        same = json.dumps(live, sort_keys=True, ensure_ascii=False) == json.dumps(
            repo, sort_keys=True, ensure_ascii=False
        )
        print(("MATCH" if same else "DIFF"), url, "<->", fname)

sys.exit(0 if ok else 1)
PY

echo "llms (HTTP):"
for u in https://marmara-pro.ru/llms.txt https://marmara-pro.ru/llms-termo.txt; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 20 "$u" || echo "000")
  echo "  $u -> HTTP $code"
done

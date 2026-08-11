#!/usr/bin/env python3
"""Generate Yandex Direct catalog pages CSV for marmara-pro.ru/termo."""

import csv
import json
import re
import urllib.request
from html import unescape
from pathlib import Path

TILDA_API = (
    "https://store.tildaapi.com/api/getproductslist/?storepartuid=840610530462"
)
OUTPUT_DIR = Path("ads/marmara-pro")
COMMA_CSV = OUTPUT_DIR / "Direkt_katalogi_marmara-pro_2026-08-11.csv"
SEMICOLON_CSV = OUTPUT_DIR / "Direkt_katalogi_marmara-pro_2026-08-11_semicolon.csv"

HEADER = [
    "Url",
    "Title",
    "Description",
    "Offer minimal price",
    "Currency",
    "Image url 1",
    "Image url 2",
    "Image url 3",
    "Image url 4",
    "Image url 5",
]

MAIN_PAGE = {
    "url": "https://marmara-pro.ru/termo",
    "title": "Термопанели с клинкерной плиткой — КлинкерПрофи",
    "description": (
        "Фасадные термопанели с клинкером. Производство в Выборге, "
        "доставка по СПб и Ленобласти. От 1300 ₽/м²."
    ),
    "price": 1300,
    "images": [
        "https://static.tildacdn.com/stor6466-3030-4162-a466-613032326463/c2c5a486a2eb09f07aa62ae439dd6247.png",
        "https://static.tildacdn.com/stor3630-6265-4432-a530-613365613737/29fed63eafa9d4236a6110e883177849.jpg",
        "https://static.tildacdn.com/stor6139-3232-4534-a638-373433303533/2fa395f52d5e102fff396747a08c73ba.png",
    ],
}


def strip_html(text: str) -> str:
    text = unescape(text or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_price_from_descr(descr: str) -> int | None:
    descr = strip_html(descr)
    m = re.search(r"(\d[\d\s]*)\s*₽", descr)
    if not m:
        return None
    return int(re.sub(r"\s", "", m.group(1)))


def product_description(product: dict) -> str:
    text = strip_html(product.get("text") or "")
    if text:
        return text[:240] + ("…" if len(text) > 240 else "")
    descr = strip_html(product.get("descr") or "")
    if descr:
        return descr
    return product["title"]


def product_price(product: dict) -> int:
    for ch in product.get("characteristics") or []:
        title = (ch.get("title") or "").lower()
        if "стоимость" in title and "м2" not in title:
            val = parse_price_from_descr(ch.get("value") or "")
            if val:
                return val
        if "м2" in title or "1 м" in title:
            val = parse_price_from_descr(ch.get("value") or "")
            if val:
                return val
    descr_price = parse_price_from_descr(product.get("descr") or "")
    if descr_price:
        return descr_price
    title = product.get("title") or ""
    if "плитка" in title.lower():
        return 1300
    return 1550


def gallery_urls(product: dict) -> list[str]:
    raw = product.get("gallery") or "[]"
    try:
        items = json.loads(raw)
    except json.JSONDecodeError:
        return []
    urls = []
    for item in items:
        img = item.get("img")
        if img:
            urls.append(img)
    if not urls and product.get("editions"):
        img = product["editions"][0].get("img")
        if img:
            urls.append(img)
    return urls[:5]


def row(url: str, title: str, description: str, price: int, images: list[str]) -> list:
    padded = images + [""] * (5 - len(images))
    return [url, title, description, price, "RUB", *padded[:5]]


def fetch_products() -> list[dict]:
    with urllib.request.urlopen(TILDA_API, timeout=30) as resp:
        data = json.load(resp)
    return data.get("products") or []


def build_rows() -> list[list]:
    rows = [row(**MAIN_PAGE)]
    for product in fetch_products():
        images = gallery_urls(product)
        rows.append(
            row(
                product["url"],
                product["title"],
                product_description(product),
                product_price(product),
                images,
            )
        )
    return rows


def write_csv(path: Path, delimiter: str, rows: list[list]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL)
        writer.writerow(HEADER)
        writer.writerows(rows)


def main() -> None:
    rows = build_rows()
    write_csv(COMMA_CSV, ",", rows)
    write_csv(SEMICOLON_CSV, ";", rows)
    print(f"Wrote {len(rows)} rows to {COMMA_CSV} and {SEMICOLON_CSV}")


if __name__ == "__main__":
    main()

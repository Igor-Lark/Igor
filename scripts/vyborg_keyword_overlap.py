#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Пересечения ключей четырёх групп Выборга."""
import re
from collections import defaultdict

LO = """
термопанели доставка Ленобласть
фасадные термопанели Питер
Купить термопанели в Ленобласти
термопанели фасадные изготовители в санкт петербурге
термопанели доставка Спб
Термопанели с клинкерной плиткой в Питере
термопанели Ленинградская область Выборг
термопанели всеволжский район
термопанели ленобласть -установка -доставка -купить
термопанели доставка Выборг
термопанели с установкой в ленобласти
Термопанели Санкт-Петербург и область
термопанели с клинкерной плиткой купить в спб
Купить термопанели в Выборге
Термопанели с клинкерной плиткой в Выборге
Термопанели с клинкерной плиткой в -питер -выборг -спб
термопанели фасадные купить в санкт петербурге
"""

GEO = """
термопанели производитель выборг
клинкерные термопанели выборг
утепление фасада выборг
термопанели каменногорск
термопанели ленинградская область -фасадный
термопанели сосновый бор
термопанели тихвин
термопанели луга
термопанели всеволожск
термопанели ленобласть
термопанели выборгский район
фасадные термопанели ленинградская область
термопанели светогорск
термопанели рощино
фасадные панели выборг
термопанели приозерск
термопанели кингисепп
"термопанели выборг"
купить термопанели в гатчине
"клинкерпрофи выборг"
"производство термопанелей выборг"
"термопанели выборг цена"
термопанели выборг купить
"термопанели выборг стоимость"
"купить термопанели выборг"
"""

COM = """
термопанель фасадная купить
термопанели для наружной отделки от производителя
термопанели от производителя купить
термопанели с доставкой
расчет термопанелей
"термопанели цена за м кв"
термопанель кирпич цена фасадная -под
"термопанели цена"
"термопанели цена за"
фасадные термопанели для дома цена
"сколько стоит обшить дом термопанелями"
купить термопанели для фасада
термопанели от производителя цена
купить термопанели для дома
"купить термопанели"
термопанели недорого от производителя
цена термопанелей фасадных под кирпич
"фасадные термопанели купить"
купить клинкерные термопанели
фасадные термопанели для наружной отделки цена
термопанели с плиткой купить
термопанели с клинкерной плиткой от производителя
термопанели заказать
"расчет термопанелей"
термопанели с плиткой от производителя -клинкерный
клинкерные термопанели от производителя -плитка
фасадные панели с утеплением
"""

PROD = """
цена термопанелей под кирпич
панели из клинкерной плитки для фасадов
термопанели под кирпич для наружной -отделка
клинкерные термопанели монтаж цена
клинкерные термопанели цена -плитка -фасад -дом -работа -монтаж
дом термопанели под кирпич
клинкерные термопанели для фасада купить
отделка дома клинкерными термопанелями цена -наружный
термопанели с клинкерной плиткой цена -фасад
фасад под кирпич термопанели
термопанели клинкерный дом -цена
"термопанели под кирпич"
термопанели под кирпич -наружный -дом -фасадный -цена -фасад
термопанели под кирпич для наружной -отделка -фасадный
фасадные термопанели с клинкером
клинкерные панели для фасада цена -м2 -утеплитель
клинкерные термопанели для дома цена -отделка
"клинкерные термопанели"
отделка дома термопанелями под кирпич -наружный -фасадный
дом термопанели под кирпич -отделка
фасадные панели с клинкером
фасадные термопанели под кирпич -наружный
"термопанели с клинкерной плиткой"
фасадные термопанели под кирпич
клинкерные панели для фасада купить -дом
клинкерные панели для фасада цена за м2
термопанели для наружной отделки дома амстердам 2
клинкерные термопанели для наружной отделки цена -дом
клинкерные панели для фасада с утеплителем -цена
термопанели амстердам
купить клинкерные панели для фасада дома
клинкерные термопанели цена работы
отделка дома фасадными термопанелями под кирпич
клинкерные панели для фасада с утеплителем цена
термопанели с клинкерной плиткой для фасада цена
"термопанели выборг"
клинкерные термопанели для фасада -купить -цена
клинкерные термопанели для фасада цена -плитка
клинкерные термопанели для наружной отделки дома цена
"фасадные термопанели с утеплителем"
термопанели под кирпич для наружной отделки -дом -фасадный
клинкерные термопанели от производителя
термопанели под кирпич для наружной отделки цены
монтаж клинкерных панелей для фасада
фасадные термопанели под кирпич для наружной отделки
термопанели с клинкерной плиткой купить
купить клинкерные термопанели -фасад -плитка
термопанели под кирпич для наружной отделки дома
термопанели под кирпич для наружной отделки -цена -дом -фасадный
термопанели колорадо
"""

GROUPS = {
    "ЛО 5773097196": LO,
    "Гео 5773898865": GEO,
    "Коммерч. 5773901452": COM,
    "Клинкер 5773902142": PROD,
}


def parse(block: str):
    items = []
    for line in block.splitlines():
        s = line.strip()
        if s:
            items.append(s)
    return items


def norm_full(s: str) -> str:
    s = s.strip().lower().replace("ё", "е")
    s = s.replace("«", '"').replace("»", '"').replace("“", '"').replace("”", '"')
    s = s.replace("\u00a0", " ")
    s = re.sub(r"\s+", " ", s)
    return s


def strip_quotes(s: str) -> str:
    s = s.strip()
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        return s[1:-1].strip()
    return s.strip('"')


def split_minuses(s: str):
    """Return (core, frozenset of minus tokens)."""
    s = strip_quotes(norm_full(s))
    tokens = s.split()
    core, minus = [], []
    for t in tokens:
        if t.startswith("-") and len(t) > 1:
            minus.append(t[1:])
        else:
            core.append(t)
    return " ".join(core), frozenset(minus)


def tokens(core: str):
    return set(re.findall(r"[а-яa-z0-9]+", core))


def has_minus(s: str) -> bool:
    _, m = split_minuses(s)
    return bool(m)


def main():
    parsed = {g: parse(b) for g, b in GROUPS.items()}
    print("COUNTS")
    for g, items in parsed.items():
        print(f"  {g}: {len(items)}")
        minus_n = sum(1 for x in items if has_minus(x))
        print(f"    with internal minus: {minus_n}")

    # exact normalized (keep quotes as match type marker by stripping for exact text)
    by_exact = defaultdict(list)
    by_core = defaultdict(list)
    by_unquoted = defaultdict(list)

    for g, items in parsed.items():
        seen = set()
        for raw in items:
            nf = norm_full(raw)
            if nf in seen:
                by_exact[nf].append((g, raw, "DUP-IN-GROUP"))
            seen.add(nf)
            by_exact[nf].append((g, raw))
            core, minus = split_minuses(raw)
            by_core[core].append((g, raw, minus))
            uq = strip_quotes(nf)
            by_unquoted[uq].append((g, raw))

    print("\n===== EXACT (same text, ignore case/ё) across groups =====")
    n = 0
    for k, v in sorted(by_exact.items(), key=lambda x: x[0]):
        groups = {x[0] for x in v}
        if len(groups) > 1:
            n += 1
            print(f"  [{', '.join(sorted(groups))}]  {k}")
            for x in v:
                print(f"      {x[0]} | {x[1]}")
    print(f"exact cross-group: {n}")

    print("\n===== SAME CORE, different minuses/quotes =====")
    n = 0
    for core, v in sorted(by_core.items(), key=lambda x: x[0]):
        groups = {x[0] for x in v}
        variants = {(x[0], x[1]) for x in v}
        if len(groups) > 1 or len(variants) > 1 and len(groups) > 1:
            # only if more than one group
            if len(groups) < 2:
                continue
            n += 1
            print(f"  CORE: {core}")
            for g, raw, minus in v:
                print(f"      {g} | {raw} | minus={sorted(minus) or '—'}")
    print(f"core cross-group: {n}")

    print("\n===== UNQUOTED same (quote vs no quote) in SAME or other group =====")
    for k, v in sorted(by_unquoted.items()):
        texts = {x[1] for x in v}
        groups = {x[0] for x in v}
        if len(texts) > 1:
            print(f"  {k}")
            for g, raw in v:
                print(f"      {g} | {raw}")

    print("\n===== INTERNAL MINUS (should be paused per 1.6) =====")
    for g, items in parsed.items():
        for raw in items:
            if has_minus(raw):
                print(f"  {g} | {raw}")

    print("\n===== GEO TOKENS: выборг / питер / спб / ленобласть / приозер =====")
    geo_re = re.compile(
        r"выборг|питер|спб|санкт|петербург|ленобласт|ленинград|всевол|гатчин|"
        r"приозер|соснов|тихвин|луга|кингисепп|светогор|рощин|каменногор|"
        r"сосновый бор|выборгск",
        re.I,
    )
    for g, items in parsed.items():
        print(f"\n  {g}")
        for raw in items:
            if geo_re.search(raw):
                print(f"    {raw}")

    print("\n===== NEAR: Jaccard >= 0.7, different groups, different core =====")
    all_items = []
    for g, items in parsed.items():
        for raw in items:
            core, minus = split_minuses(raw)
            all_items.append((g, raw, core, tokens(core)))

    seen_pairs = set()
    for i, a in enumerate(all_items):
        for b in all_items[i + 1 :]:
            if a[0] == b[0]:
                continue
            if a[2] == b[2]:
                continue
            ta, tb = a[3], b[3]
            if not ta or not tb:
                continue
            inter = ta & tb
            union = ta | tb
            j = len(inter) / len(union)
            # also subset
            subset = ta <= tb or tb <= ta
            if j >= 0.72 or (subset and len(inter) >= 3):
                key = tuple(sorted([a[1], b[1]]))
                if key in seen_pairs:
                    continue
                seen_pairs.add(key)
                print(f"  J={j:.2f} sub={subset} | {a[0]}: {a[1]}")
                print(f"           | {b[0]}: {b[1]}")
                print(f"           common: {sorted(inter)}")


if __name__ == "__main__":
    main()

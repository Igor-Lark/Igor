#!/usr/bin/env python3
"""Анализ выгрузки RB 05–10.10.2026 → Word."""

import csv
from collections import Counter, defaultdict
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

CSV_PATH = Path(__file__).resolve().parent / "2026-10-10_vitaminki21_zaprosy.csv"
OUT = Path(__file__).resolve().parent / "Analiz_trafika_RB_Popaj_2026-10-10.docx"
OUT_LOCAL = Path(__file__).resolve().parent.parent / "локальная" / OUT.name

NAVY = RGBColor(0x0B, 0x3D, 0x5C)
GRAY = RGBColor(0x33, 0x33, 0x33)
RED = RGBColor(0x8B, 0x1A, 0x1A)

MINUS_ADD = """-форелев
-форелевое
-форелевая
-форелевое хозяйство
-прокат катамаран
-прокат катамаранов
-аренда лод
-аренда лодки
-аренда лодок
-виа феррата
-батилиман
-марисоль
-кемер
-пилатес
-реформер
-промыслов
-спортивная рыбалка
-водный транспорт
-морские экскурсии
-морской порт
-сочинский порт
-имеретинский морской порт
-рыбак запольрья
-что такое барабулька
-дети в сочи
-лоо
-гидом
-с гидом
-инструктор
-волейбол
-площадки для пляжного
-рыбалтика
-подводн
-мангал
-снасть на морскую
-танкере
-платная рыбалка
-sea guide
-медуза
-корабл
-балаклав
-крис крафт"""


def num(s):
    if not s or s == "-":
        return 0.0
    return float(str(s).replace(" ", "").replace("\xa0", "").replace(",", "."))


def load_rows():
    rows = []
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if r.get("День") == "Итого":
                continue
            rows.append(r)
    return rows


def agg(rows, key_fn):
    d = defaultdict(lambda: {"cost": 0.0, "imp": 0, "clk": 0, "conv": 0})
    for r in rows:
        k = key_fn(r)
        d[k]["cost"] += num(r.get("Расход, ₽", 0))
        d[k]["imp"] += int(num(r.get("Показы", 0)))
        d[k]["clk"] += int(num(r.get("Клики", 0)))
        d[k]["conv"] += int(num(r.get("Конверсии", 0)))
    return d


def set_run(run, *, bold=False, size=11, color=GRAY, font="Arial"):
    run.bold = bold
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.font.name = font


def add_p(doc, text, *, bold=False, size=11, color=GRAY):
    p = doc.add_paragraph()
    run = p.add_run(text)
    set_run(run, bold=bold, size=size, color=color)
    p.paragraph_format.space_after = Pt(6)


def add_heading(doc, text, level=1):
    p = doc.add_paragraph()
    run = p.add_run(text)
    set_run(run, bold=True, size=16 if level == 1 else 13, color=NAVY)
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(6)


def add_bullets(doc, items, *, color=GRAY):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.clear()
        run = p.add_run(item)
        set_run(run, size=11, color=color)


def add_code(doc, text):
    for line in text.strip().splitlines():
        p = doc.add_paragraph()
        run = p.add_run(line)
        set_run(run, size=10, font="Consolas")
        p.paragraph_format.space_after = Pt(0)


def shade_cell(cell, hex_color):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), hex_color)
    shd.set(qn("w:val"), "clear")
    tcPr.append(shd)


def add_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = ""
        run = cell.paragraphs[0].add_run(h)
        set_run(run, bold=True, size=10, color=RGBColor(0xFF, 0xFF, 0xFF))
        shade_cell(cell, "0B3D5C")
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            cell = table.rows[ri + 1].cells[ci]
            cell.text = ""
            run = cell.paragraphs[0].add_run(str(val))
            set_run(run, size=10)
    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = Cm(w)
    doc.add_paragraph()


def build():
    rows = load_rows()
    days = sorted(set(r["День"] for r in rows))
    total = {"imp": 0, "clk": 0, "conv": 0, "cost": 0.0}
    for r in rows:
        total["imp"] += int(num(r["Показы"]))
        total["clk"] += int(num(r["Клики"]))
        total["conv"] += int(num(r["Конверсии"]))
        total["cost"] += num(r.get("Расход, ₽", 0))
    ctr = total["clk"] / total["imp"] * 100 if total["imp"] else 0

    by_group = agg(rows, lambda r: r["Название группы"].strip())
    by_place = agg(rows, lambda r: r.get("Тип площадки", "?"))
    by_cond = agg(rows, lambda r: r.get("Тип условия показа", "?"))
    by_age = agg(rows, lambda r: r.get("Возраст", "?"))
    by_gender = agg(rows, lambda r: r.get("Пол", "?"))
    by_ad = agg(rows, lambda r: r.get("№ Объявления", "?"))
    by_day = agg(rows, lambda r: r["День"])

    g10_fish = sum(
        int(num(r["Показы"]))
        for r in rows
        if "G10" in r["Название группы"]
        and any(
            x in (r.get("Текст", "") + r.get("Заголовок", "")).lower()
            for x in ["барабул", "ставрид", "пеламид"]
        )
    )
    g10_imp = by_group.get("G10 - рыбаки", {}).get("imp", 0)
    auto_imp = by_cond.get("Автотаргетинг", {}).get("imp", 0)

    doc = Document()
    p = doc.add_paragraph()
    run = p.add_run("Анализ трафика RB · 05–10.10.2026")
    set_run(run, bold=True, size=18, color=NAVY)
    add_p(
        doc,
        "ЕПК «Групповая рыбалка» · vitaminki21 · № 713632237 · пакет 710298920 с GP",
        size=10,
    )
    add_p(
        doc,
        f"Период: {days[0]} — {days[-1]} ({len(days)} дн., 10.10 — утренний срез) · "
        f"Показы {total['imp']} · Клики {total['clk']} · Конверсии {total['conv']} · "
        f"CTR {ctr:.1f}% · Расход {total['cost']:.0f} ₽.",
        bold=True,
    )
    add_p(
        doc,
        "Сравнение: 05.10 один день = 53 п / 0 к. За 6 дней = 460 п / 6 к / 0 конв. "
        "Объём ~70–130 п/день (кроме 10.10). Конверсий по RB нет.",
        size=10,
    )

    add_heading(doc, "1. Главный вывод")
    add_bullets(
        doc,
        [
            "0 конверсий за 6 дней · CTR 1,3% · все 6 кликов с автотаргета. "
            "Стратегию / бюджет 12 000 / цены пакета 710298920 — не трогать.",
            f"Автотаргет = {auto_imp}/{total['imp']} показов "
            f"({100 * auto_imp / total['imp']:.0f}%). Ручные фразы почти без кликов.",
            f"G10: тексты «барабулька/ставрида» — {g10_fish}/{g10_imp} показов. "
            "Правка 01.09 не сохранена / откатилась. Срочно заменить текст.",
            "G1–G3: в текстах слоты 10:00/13:00/16:00 и даже 9:30/12:30/15:30 — "
            "неверно. Нужно 7:00/10:00/13:00/16:00.",
            "Мусор автотаргета даёт объём без кликов: «рыбалка» 87 п / 0 к; "
            "морской порт, гид, аренда лодок, инструктор, волейбол (1 клик!).",
            "Октябрь: G5 (барабулька/пеламида) лидер по показам (130) — сезон на спаде; "
            "G11 луфарь 98 п / 1 к (мусорный клик). Акцент сдвигать на G11+G10+G1.",
        ],
        color=RED,
    )

    add_heading(doc, "2. Сводка по группам")
    g_rows = []
    for name, v in sorted(by_group.items(), key=lambda x: -x[1]["imp"]):
        c = v["clk"] / v["imp"] * 100 if v["imp"] else 0
        g_rows.append([name[:40], v["imp"], v["clk"], v["conv"], f"{c:.1f}%"])
    add_table(doc, ["Группа", "Показы", "Клики", "Конв.", "CTR"], g_rows, [5.5, 2, 2, 1.5, 1.5])

    add_heading(doc, "3. Динамика по дням")
    d_rows = []
    for d in days:
        v = by_day[d]
        c = v["clk"] / v["imp"] * 100 if v["imp"] else 0
        d_rows.append([d, v["imp"], v["clk"], f"{c:.1f}%"])
    add_table(doc, ["День", "Показы", "Клики", "CTR"], d_rows, [3, 2.5, 2.5, 2])
    add_p(
        doc,
        "06.10 — единственный день с 4 кликами (все G10+G11+G5). "
        "08–09.10 рост показов без кликов. 10.10 — неполный день (выгрузка 05:30).",
        size=10,
    )

    add_heading(doc, "4. Площадки и условие")
    add_table(
        doc,
        ["Площадка", "Показы", "Клики"],
        [[k, v["imp"], v["clk"]] for k, v in sorted(by_place.items(), key=lambda x: -x[1]["imp"])],
        [4, 2.5, 2.5],
    )
    add_table(
        doc,
        ["Условие", "Показы", "Клики"],
        [[k, v["imp"], v["clk"]] for k, v in sorted(by_cond.items(), key=lambda x: -x[1]["imp"])],
        [4, 2.5, 2.5],
    )
    add_p(
        doc,
        "Поиск 416 п / 5 к · Сети 44 п / 1 к. Фраза 74 п / 0 к — ключи есть, "
        "но кликов нет (мало коммерческих запросов / слабые объявления).",
        size=10,
    )

    add_heading(doc, "5. Клики (все 6)")
    add_bullets(
        doc,
        [
            "06.10 G10 «морская рыбалка сочи» — целевой",
            "06.10 G10 «рыболовный тур в сочи» — околоцелевой",
            "06.10 G11 «площадки для пляжного волейбола» — МУСОР, минус",
            "06.10 G5 РСЯ без запроса — слабый сигнал",
            "07.10 G10 «катамаран медуза сочи» — чужой борт, минус −медуза",
            "09.10 G10 «морская рыбалка» — широкий, ок",
        ],
    )

    add_heading(doc, "6. Минус-фразы (добавить)")
    add_code(doc, MINUS_ADD)

    add_heading(doc, "7. По группам")
    add_heading(doc, "G10 — рыбаки (116 п / 4 к)", 2)
    add_bullets(
        doc,
        [
            f"Текст «На барабульку и ставриду…» на {g10_fish}/{g10_imp} показов — "
            "заменить на Сочи/море/2800 без вида рыбы.",
            "Объявление № 1919233043117772392 — в отчёте смесь Активные/Остановленные "
            "(комбинаторные варианты). Проверить, что нужные тексты активны.",
            "Лучшие клики: «морская рыбалка сочи», «рыболовный тур».",
        ],
    )
    add_heading(doc, "G11 — луфарь (98 п / 1 к)", 2)
    add_bullets(
        doc,
        [
            "Единственный клик — волейбол. Минусы §6 обязательны.",
            "Запрос «луфарь в сириусе» — 1 показ / 0 кликов. Спрос тонкий, но группа нужна.",
            "Не копировать интересы G10.",
        ],
    )
    add_heading(doc, "G1–G3 (115 п / 0 к)", 2)
    add_bullets(
        doc,
        [
            "№ 1918830392081206022: 05.10 Архивные → с 06.10 Активные.",
            "Слоты в текстах: 10:00/13:00/16:00 и 9:30/12:30/15:30 — исправить на "
            "7:00/10:00/13:00/16:00.",
            "Мусор: рыбалка с гидом (8 п), инструктор (5), морской порт.",
        ],
    )
    add_heading(doc, "G5 — лето-бархат (130 п / 1 к)", 2)
    add_bullets(
        doc,
        [
            "Лидер по показам в октябре — спорно: барабулька/пеламида на спаде.",
            "Инфо-запросы: «пеламида сочи октябрь», «ставридка в октябре», "
            "«что такое барабулька» — не бронь.",
            "Не разгонять; минусы §6; пеламиду не убирать из G5, но не ставить в приоритет.",
        ],
    )
    add_heading(doc, "G9 (1 п)", 2)
    add_bullets(doc, ["Почти не крутится — нормально при малом бюджете пакета."])

    add_heading(doc, "8. Возраст / пол")
    add_table(
        doc,
        ["Возраст", "Показы"],
        [[k, v["imp"]] for k, v in sorted(by_age.items(), key=lambda x: -x[1]["imp"])],
        [4, 2.5],
    )
    add_table(
        doc,
        ["Пол", "Показы", "Клики"],
        [
            [k, v["imp"], v["clk"]]
            for k, v in sorted(by_gender.items(), key=lambda x: -x[1]["imp"])
        ],
        [4, 2.5, 2.5],
    )
    add_p(doc, "Корректировки по возрасту НЕ добавлять: 0 конверсий, обучение пакета.", bold=True)

    add_heading(doc, "9. Объявления")
    ad_groups = defaultdict(set)
    ad_status = defaultdict(Counter)
    for r in rows:
        ad = r.get("№ Объявления")
        ad_groups[ad].add((r.get("Название группы") or "").strip())
        ad_status[ad][r.get("Статус объявления") or "?"] += int(num(r["Показы"]))
    ad_rows = []
    for ad, v in sorted(by_ad.items(), key=lambda x: -x[1]["imp"]):
        st = ", ".join(f"{k}:{n}" for k, n in ad_status[ad].most_common())
        ad_rows.append(
            [ad, ", ".join(sorted(ad_groups[ad]))[:24], v["imp"], v["clk"], st[:28]]
        )
    add_table(
        doc,
        ["№ объявления", "Группа", "Показы", "Клики", "Статус (показы)"],
        ad_rows,
        [4.2, 3.2, 1.6, 1.4, 3.5],
    )

    add_heading(doc, "10. Чеклист")
    add_bullets(
        doc,
        [
            "☐ Минусы §6 на кампанию (или все группы)",
            "☐ G10: текст без барабульки/ставриды (№ 1919233043117772392)",
            "☐ G1–G3: слоты 7:00/10:00/13:00/16:00 во всех текстах",
            "☐ Проверить активные/остановленные варианты объявлений G10/G11/G5",
            "☐ Сверить в пакете долю GP vs RB за неделю + конверсии GP",
            "☐ Стратегия / 12 000 ₽ / CPA — не трогать",
            "☐ Возраст — не трогать",
        ],
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    try:
        OUT_LOCAL.parent.mkdir(parents=True, exist_ok=True)
        doc.save(OUT_LOCAL)
    except OSError:
        pass
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()

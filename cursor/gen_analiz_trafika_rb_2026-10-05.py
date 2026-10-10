#!/usr/bin/env python3
"""Анализ выгрузки RB 05.10.2026 → Word."""

import csv
from collections import defaultdict
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

CSV_PATH = Path(__file__).resolve().parent / "2026-10-05_vitaminki21_zaprosy.csv"
OUT = Path(__file__).resolve().parent / "Analiz_trafika_RB_Popaj_2026-10-05.docx"
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
-виа феррата
-батилиман
-марисоль
-марисоль риф
-кемер
-пилатес
-реформер
-промыслов
-спортивная рыбалка
-водный транспорт
-морские экскурсии
-морской порт
-сочинский порт
-рыбак запольрья
-что такое барабулька
-дети в сочи
-лоо
-гидом
-с гидом"""


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

    junk_queries = []
    for r in rows:
        q = (r.get("Поисковый запрос") or "").strip().lower()
        if not q:
            continue
        junk_marks = [
            "форелев",
            "прокат",
            "виа феррата",
            "батилиман",
            "марисоль",
            "кемер",
            "пилатес",
            "промыслов",
            "спортивная",
            "водный транспорт",
            "морские экскурсии",
            "морской порт",
            "сочинский порт",
            "запольрья",
            "что такое",
            "дети в сочи",
            "лоо",
            "с гидом",
        ]
        if any(m in q for m in junk_marks):
            junk_queries.append(
                f"«{r.get('Поисковый запрос')}» → {r.get('Название группы')} ({int(num(r['Показы']))} п)"
            )

    doc = Document()
    p = doc.add_paragraph()
    run = p.add_run("Анализ трафика RB · 05.10.2026")
    set_run(run, bold=True, size=18, color=NAVY)
    add_p(
        doc,
        "ЕПК «Групповая рыбалка» · vitaminki21 · № 713632237 · пакет 710298920 с GP",
        size=10,
    )
    add_p(
        doc,
        f"Период: {days[0]} ({len(days)} дн.) · "
        f"Показы {total['imp']} · Клики {total['clk']} · Конверсии {total['conv']} · "
        f"CTR {ctr:.1f}% · Расход {total['cost']:.0f} ₽ "
        "(оплата за конверсии; кликов/конверсий нет).",
        bold=True,
    )
    add_p(
        doc,
        "Внимание: выгрузка за 1 день. Для обучения пакета смотреть суммарно GP+RB за неделю "
        "Пн–Вс. Эта выгрузка — срез качества запросов RB, не итог обучения.",
        size=10,
        color=RED,
    )

    add_heading(doc, "1. Главный вывод")
    add_bullets(
        doc,
        [
            "05.10: только 53 показа / 0 кликов / 0 конверсий — объём RB очень низкий "
            "(для сравнения 24–30.08 было ~120 п/день). Проверить: бюджет пакета 12 000 "
            "не ушёл ли в GP, лимиты, статус обучения.",
            "Автотаргет = 43 из 53 показов (~81%). Ручные фразы почти не крутятся. "
            "Мусор автотаргета — главный источник нецелевого трафика.",
            "G10: тексты снова «На барабульку и ставриду» — "
            f"{g10_fish} из {g10_imp} показов. Правка 01.09 не держится или не сохранена.",
            "G11 лидер по показам (20) — ок для октября, но почти всё автотаргет + мусор "
            "(форель, прокат, виа феррата, Кемер).",
            "G1–G3: объявление № 1918830392081206022 снова Активные; заголовок 3 обновлён. "
            "В тексте слоты 10:00/13:00/16:00 — нет 7:00.",
            "Стратегию / бюджет / цены целей пакета 710298920 — не трогать. "
            "Можно: минусы, тексты G10, слоты в текстах.",
        ],
        color=RED,
    )

    add_heading(doc, "2. Сводка по группам")
    g_rows = []
    for name, v in sorted(by_group.items(), key=lambda x: -x[1]["imp"]):
        c = v["clk"] / v["imp"] * 100 if v["imp"] else 0
        g_rows.append([name[:40], v["imp"], v["clk"], v["conv"], f"{c:.0f}%"])
    add_table(doc, ["Группа", "Показы", "Клики", "Конв.", "CTR"], g_rows, [5.5, 2, 2, 1.5, 1.5])
    add_p(doc, "G9 в выгрузке нет (0 показов за день).", size=10)

    add_heading(doc, "3. Площадки и условие показа")
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
        "Поиск 51 п / Сети 2 п. Автотаргет доминирует — при 0 кликов править автотаргет "
        "через минусы, не через выключение (иначе ещё меньше объёма).",
        size=10,
    )

    add_heading(doc, "4. Мусорные запросы (минусовать)")
    if junk_queries:
        add_bullets(doc, junk_queries)
    else:
        add_p(doc, "Явного мусора в этой выгрузке мало — но объём тоже маленький.", size=10)
    add_p(doc, "Минус-фразы (столбиком, копипаст в Директ):", bold=True)
    add_code(doc, MINUS_ADD)

    add_heading(doc, "5. По группам — что править")
    add_heading(doc, "G10 — рыбаки", 2)
    add_bullets(
        doc,
        [
            f"Тексты с барабулькой/ставридой: {g10_fish}/{g10_imp} показов — заменить на «Сочи / море / 2800».",
            "Запрос «рыбалка в лоо» по фразе «рыбалка черное море сочи» — минус −лоо.",
            "Целевые: «морская рыбалка сочи», «рыбалка в сочи на катере» — ок, оставлять.",
        ],
    )
    add_heading(doc, "G11 — луфарь", 2)
    add_bullets(
        doc,
        [
            "20 показов / 0 кликов · объявление № 1919656966051937203.",
            "Мусор: форелевое хозяйство, прокат катамаранов, батилиман/виа феррата, "
            "марисоль риф, промысловое рыболовство, спортивная рыбалка, краснодарский край.",
            "Заголовки с «луфарь» есть — хорошо. Общие «3 часа в море» тоже крутятся — "
            "не критично при малом объёме.",
            "Запросов именно «луфарь» в выгрузке нет — спрос слабый / автотаргет размывает.",
        ],
    )
    add_heading(doc, "G1–G3", 2)
    add_bullets(
        doc,
        [
            "Объявление № 1918830392081206022 — статус Активные, заголовок 3 без барабульки — ок.",
            "Текст со слотами: «выходы в 10:00/13:00/16:00» — добавить 7:00 "
            "(факт с 01.09: 7:00 / 10:00 / 13:00 / 16:00).",
            "Инфо-запросы «какую рыбу ловят в сириусе», «что ловят в сириусе» — слабый интент; "
            "можно минусовать «какую рыбу», «что ловят» если повторятся.",
            "Мусор: «морская рыбалка кемер», «морской порт сочи», «рыбалка с гидом».",
        ],
    )
    add_heading(doc, "G5 — лето-бархат", 2)
    add_bullets(
        doc,
        [
            "Новые объявления: № 1919869437011027646, № 1920017686397861306 + старое 1918916858360262936.",
            "Середина октября: барабулька/пеламида уже на спаде; ставрида и луфарь (G11) важнее. "
            "G5 не выключать резко, но не разгонять бюджет внутрь группы.",
            "Инфо: «что такое барабулька», «дети … барабульку» — минусы.",
            "Мусор: «пилатес реформер», «водный транспорт сириус», «морские экскурсии сириус».",
        ],
    )

    add_heading(doc, "6. Возраст / пол (справочно)")
    add_table(
        doc,
        ["Возраст", "Показы"],
        [[k, v["imp"]] for k, v in sorted(by_age.items(), key=lambda x: -x[1]["imp"])],
        [4, 2.5],
    )
    add_table(
        doc,
        ["Пол", "Показы"],
        [[k, v["imp"]] for k, v in sorted(by_gender.items(), key=lambda x: -x[1]["imp"])],
        [4, 2.5],
    )
    add_p(
        doc,
        "Корректировки по возрасту НЕ добавлять: 0 кликов / 0 конв., обучение пакета.",
        bold=True,
    )

    add_heading(doc, "7. Объявления в отчёте")
    ad_groups = defaultdict(set)
    for r in rows:
        ad_groups[r.get("№ Объявления")].add(r.get("Название группы"))
    ad_rows = []
    for ad, v in sorted(by_ad.items(), key=lambda x: -x[1]["imp"]):
        ad_rows.append([ad, ", ".join(sorted(ad_groups[ad]))[:28], v["imp"], v["clk"]])
    add_table(doc, ["№ объявления", "Группа", "Показы", "Клики"], ad_rows, [4.5, 4, 2, 2])

    add_heading(doc, "8. Чеклист")
    add_bullets(
        doc,
        [
            "☐ Минусы §4 на кампанию (или G10+G11+G1+G5)",
            "☐ G10: убрать «барабулька/ставрида» из текстов объявления № 1919233043117772392",
            "☐ G1–G3: в тексте слоты 7:00/10:00/13:00/16:00",
            "☐ Проверить в пакете 710298920: сколько бюджета/показов уходит в GP vs RB за неделю",
            "☐ Выгрузить неделю (Пн–Вс), не 1 день — иначе нельзя судить об обучении",
            "☐ Стратегия / 12 000 ₽ / цены целей — не трогать",
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

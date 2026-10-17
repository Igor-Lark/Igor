#!/usr/bin/env python3
"""Анализ РК «Закат на море» 12–17.10.2026 → Word."""

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

OUT = Path(__file__).resolve().parent / "Analiz_RK_Zakat_na_more_12-17_2026-10-17.docx"


def set_run_font(run, size=11, bold=False, color=None, name="Calibri"):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    run.bold = bold
    if color:
        run.font.color.rgb = color


def add_heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        set_run_font(
            run,
            size=16 if level == 1 else (13 if level == 2 else 12),
            bold=True,
            color=RGBColor(0x0B, 0x3D, 0x5C),
        )
    return p


def add_p(doc, text, *, bold=False, size=11, space_after=6):
    p = doc.add_paragraph()
    run = p.add_run(text)
    set_run_font(run, size=size, bold=bold)
    p.paragraph_format.space_after = Pt(space_after)
    return p


def add_bullets(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        run = p.add_run(item)
        set_run_font(run, size=11)
        p.paragraph_format.space_after = Pt(2)


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
        set_run_font(run, size=10, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
        shade_cell(cell, "0B3D5C")
    for r_i, row in enumerate(rows):
        for c_i, val in enumerate(row):
            cell = table.rows[r_i + 1].cells[c_i]
            cell.text = ""
            run = cell.paragraphs[0].add_run(str(val))
            set_run_font(run, size=10)
            if r_i % 2 == 1:
                shade_cell(cell, "F2F7FA")
    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = Cm(w)
    doc.add_paragraph()
    return table


def add_minus_lines(doc, phrases):
    for phrase in phrases:
        p = doc.add_paragraph()
        run = p.add_run(phrase)
        set_run_font(run, size=11)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.space_before = Pt(0)


def build():
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.8)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(1.8)

    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t.add_run("АНАЛИЗ КАМПАНИИ")
    set_run_font(r, size=12, bold=True, color=RGBColor(0x0B, 0x3D, 0x5C))

    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t.add_run("Закат на море — 12–17.10")
    set_run_font(r, size=18, bold=True, color=RGBColor(0x0B, 0x3D, 0x5C))

    for line in [
        "Группа 5779888441 · vitaminki21 · код ZK · Поиск + РСЯ",
        "CSV 2026-10-17_22-00-30_vitaminki21 · после минусов и фраз 10.10",
        "Стратегию, бюджет и цели не менять",
    ]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(line)
        set_run_font(r, size=10, color=RGBColor(0x44, 0x44, 0x44))

    add_heading(doc, "1. Короткий вердикт", 1)
    add_bullets(
        doc,
        [
            "12–17.10: 0 ₽ · 381 показ · 6 кликов · 0 конв. · CTR 1,57%.",
            "РСЯ 376/5/0 (CTR 1,33%). Поиск 5/1/0 (CTR 20%). Расход 0 — Директ не ставил.",
            "Автотаргет = 381/6/0, 100%. Ключи-фразы с 10.10 в выгрузке не открутились ни разу.",
            "На Поиске слова «закат / вечер / для двоих» нет. Клики: «сочи морпорт яхта» + дневной Сириус.",
            "Проверить в Директе: фразы в группе 5779888441, не на паузе, фразовое соответствие.",
            "Стратегию не трогать: 0 конв., меньше 10/нед. РСЯ не выключать.",
        ],
    )

    add_heading(doc, "2. Два среза октября", 1)
    add_table(
        doc,
        ["Метрика", "05–10.10", "12–17.10"],
        [
            ["Расход", "156 ₽", "0 ₽"],
            ["Показы", "159", "381"],
            ["Клики", "6", "6"],
            ["Конверсии", "1", "0"],
            ["CTR", "3,77%", "1,57%"],
            ["РСЯ п/к/конв", "143/4/1", "376/5/0"],
            ["Поиск п/к/конв", "16/2/0", "5/1/0"],
            ["Ключи-фразы п/к", "3/0", "0/0"],
        ],
        col_widths=[5, 5.5, 5.5],
    )
    add_p(
        doc,
        "Показы сетей выросли, клики те же, конверсий нет, CTR РСЯ упал с 2,8% до 1,3%. "
        "Прошлая конверсия была платным видеокликом за 156 ₽. В этом срезе видео 48 показов / 0 кликов.",
    )

    add_heading(doc, "3. Поиск vs РСЯ", 1)
    add_table(
        doc,
        ["Площадка", "Расход", "Показы", "Клики", "Конв.", "CTR"],
        [
            ["Итого", "0 ₽", "381", "6", "0", "1,57%"],
            ["РСЯ", "0 ₽", "376", "5", "0", "1,33%"],
            ["Поиск", "0 ₽", "5", "1", "0", "20%"],
        ],
        col_widths=[3.5, 2.5, 2.5, 2.2, 2.2, 2.5],
    )

    add_heading(doc, "4. По дням", 1)
    add_table(
        doc,
        ["День", "Показы", "Клики", "Конв.", "Поиск п/к", "РСЯ п/к"],
        [
            ["12.10 пн", "34", "0", "0", "0/0", "34/0"],
            ["13.10", "27", "2", "0", "1/1", "26/1"],
            ["14.10", "45", "1", "0", "1/0", "44/1"],
            ["15.10", "39", "1", "0", "0/0", "39/1"],
            ["16.10", "60", "0", "0", "1/0", "59/0"],
            ["17.10 сб", "176", "2", "0", "2/0", "174/2"],
        ],
        col_widths=[2.8, 2.4, 2.2, 2.2, 3.0, 3.0],
    )
    add_p(doc, "Суббота 17.10 — скачок показов РСЯ (176), 2 клика, 0 конв.")

    add_heading(doc, "5. Ключи 10.10 не вышли", 1)
    add_p(
        doc,
        "В CSV нет ни одной ключевой фразы — только автотаргет. "
        "Значит «прогулка по вечернему морю сириус», имеретинский закат, "
        "«закат на яхте в сочи», «яхта на закате», «для двоих» за неделю не получили показов.",
        bold=True,
    )
    add_p(doc, "Проверить в группе 5779888441:")
    add_bullets(
        doc,
        [
            "фразы висят именно в этой группе, не в Сириусе;",
            "статус «активно», не мало показов / отклонено;",
            "соответствие фразовое, без лишнего «-аренда»;",
            "если висят и 0 показов — октябрьский спрос на закат слабый, автотаргет забирает аукцион.",
        ],
    )

    add_heading(doc, "6. Шесть кликов", 1)
    add_table(
        doc,
        ["День", "Площадка", "Что", "Вердикт"],
        [
            ["13.10", "Поиск", "сочи морпорт яхта · автотаргет · поз. 4", "Общий флот / SR, не закат"],
            ["13–17", "РСЯ ТГО", "«Вечерняя прогулка…» · закат в море.jpg · 4 клика", "Свой креатив, 0 конв."],
            ["17.10", "РСЯ ТГО", "«Всю яхту — с 18:00» · закат 02.jpg · 1 клик", "Свой, 0 конв."],
        ],
        col_widths=[2.2, 2.6, 8.0, 4.0],
    )

    add_heading(doc, "7. Поиск — 4 запроса", 1)
    add_table(
        doc,
        ["Запрос", "П/К", "Вердикт"],
        [
            ["сочи морпорт яхта", "1/1", "SR / общий чартер. Не ключ ZK"],
            ["катание на яхте сириус", "2/0", "День SR"],
            ["прогулка на яхте сириус", "1/0", "День SR"],
            ["романтический ужин на яхте", "1/0", "Близко к закату. Добавить ключ"],
        ],
        col_widths=[8.0, 2.5, 6.0],
    )

    add_heading(doc, "8. Минусы — добавить", 1)
    add_p(doc, "Столбиком, к уже внесённым 10.10:", bold=True)
    add_minus_lines(doc, ["катание"])
    add_p(
        doc,
        "Не минусовать: закат, вечерняя, для двоих, целиком, аренда, ужин, романтическ, морпорт, имеретинск.",
    )

    add_heading(doc, "9. Ключи", 1)
    add_heading(doc, "9.1. Сначала проверить, что уже добавленные живы", 2)
    add_p(doc, "Не дублировать пачку 10.10, пока не видно их в статистике группы.")
    add_heading(doc, "9.2. Добавить одно", 2)
    add_bullets(doc, ['"романтический ужин на яхте"'])
    add_heading(doc, "9.3. Не масштабировать", 2)
    add_bullets(
        doc,
        [
            "сочи морпорт яхта",
            "катание / прогулка на яхте сириус — без закат/вечер",
        ],
    )

    add_heading(doc, "10. Креативы РСЯ", 1)
    add_table(
        doc,
        ["Креатив", "Показы", "Клики", "Конв."],
        [
            ["Вечерняя прогулка, яхта только для вас", "118", "4", "0"],
            ["Бронируйте… всю яхту — с 18:00", "177", "1", "0"],
            ["закат в море.jpg", "124", "4", "0"],
            ["закат 05.jpg", "136", "0", "0"],
            ["Видео", "48", "0", "0"],
            ["закат 2.jpg (конверсия 09.10)", "17", "0", "0"],
        ],
        col_widths=[8.5, 2.8, 2.5, 2.5],
    )
    add_p(
        doc,
        "Клики сетей сидят на «закат в море.jpg» + заголовок вечерней прогулки. "
        "Конверсионное видео прошлой недели в этом срезе молчит. Тексты не трогать.",
    )

    add_heading(doc, "11. Чего не делать", 1)
    add_bullets(
        doc,
        [
            "Не менять стратегию, бюджет и цели — 0 конв.",
            "Не выключать РСЯ.",
            "Не включать галерею и не подключать профиль организации.",
            "Не вести на /progulki_na_yacht, /delfin, не писать 1 800 / 2 500.",
            "Не дублировать ключи 10.10, пока не проверены в группе.",
        ],
    )

    add_heading(doc, "12. План", 1)
    add_table(
        doc,
        ["Когда", "Действие"],
        [
            ["Сегодня", "Проверить фразы 10.10 в группе 5779888441"],
            ["Сегодня", "Минус катание; ключ «романтический ужин на яхте»"],
            ["Следующая выгрузка", "Есть ли показы у фраз ядра"],
            ["После 10 конв./нед", "Цели 160–180 ₽, не раньше"],
        ],
        col_widths=[4, 13],
    )

    add_heading(doc, "13. Источники", 1)
    add_bullets(
        doc,
        [
            "CSV: 2026-10-17_22-00-30_vitaminki21.csv (группа 5779888441, 12–17.10)",
            "Предыдущий: 05–10.10, 156 ₽ · 6/1, Word 05-10",
            "Память: cursor/Zakat_campaign_memory.md",
        ],
    )

    doc.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()

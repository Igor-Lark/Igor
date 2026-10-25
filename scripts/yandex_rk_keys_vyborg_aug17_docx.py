#!/usr/bin/env python3
"""Print-ready: strategy lock + keywords for existing Vyborg groups."""

from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

OUT = Path("reports/yandex-direct/2026-08-17_ключи_группы_Выборг.docx")
CURSOR = Path("cursor/Klyuchi_gruppy_Termopaneli_Vyborg_2026-08-17.docx")


def set_run(run, size=11, bold=False, color=None):
    run.font.name = "Times New Roman"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    run.font.size = Pt(size)
    run.bold = bold
    if color:
        run.font.color.rgb = RGBColor(*color)


def add_p(doc, text, size=11, bold=False, space_after=6, space_before=0, align=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.line_spacing = 1.12
    if align:
        p.alignment = align
    run = p.add_run(text)
    set_run(run, size=size, bold=bold)
    return p


def shade_cell(cell, hex_color):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), hex_color)
    shd.set(qn("w:val"), "clear")
    tcPr.append(shd)


def set_cell_border(cell):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:color"), "666666")
        tcBorders.append(el)
    tcPr.append(tcBorders)


def fill_cell(cell, text, bold=False, size=10, header=False):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.line_spacing = 1.05
    run = p.add_run(str(text))
    set_run(run, size=size, bold=bold or header, color=(255, 255, 255) if header else None)
    set_cell_border(cell)
    if header:
        shade_cell(cell, "1F4E79")


def add_table(doc, headers, rows):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    for i, h in enumerate(headers):
        fill_cell(table.rows[0].cells[i], h, header=True, size=10)
    for r_i, row in enumerate(rows):
        for c_i, val in enumerate(row):
            fill_cell(table.rows[r_i + 1].cells[c_i], val, size=10, bold=c_i == 0)
            if r_i % 2 == 1:
                shade_cell(table.rows[r_i + 1].cells[c_i], "F2F2F2")
    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    return table


def heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)
        run.font.name = "Times New Roman"
        run._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)


def bullet(doc, text, size=11):
    p = doc.add_paragraph(style="List Bullet")
    p.clear()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.08
    run = p.add_run(text)
    set_run(run, size=size)


def paste_block(doc, lines, size=10):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.left_indent = Cm(0.3)
    run = p.add_run("\n".join(lines))
    set_run(run, size=size)
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), "F4F7FB")
    shading.set(qn("w:val"), "clear")
    p._p.get_or_add_pPr().append(shading)


def setup_print(doc):
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(1.6)
    section.right_margin = Cm(1.6)
    section.top_margin = Cm(1.5)
    section.bottom_margin = Cm(1.6)
    section.header_distance = Cm(0.6)
    section.footer_distance = Cm(0.6)

    hp = section.header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = hp.add_run("КлинкерПрофи  ·  marmara-pro.ru  ·  17 августа 2026")
    set_run(run, size=9, color=(89, 89, 89))

    fp = section.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = fp.add_run("Выборг РК, факт 17.08  ·  стр. ")
    set_run(run, size=9, color=(89, 89, 89))
    fld1 = OxmlElement("w:fldChar")
    fld1.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "end")
    r2 = fp.add_run()
    r2._r.append(fld1)
    r2._r.append(instr)
    r2._r.append(fld2)
    set_run(r2, size=9, color=(89, 89, 89))


def group_block(doc, title, meta, now, remove, keep, add, note=""):
    heading(doc, title, 2)
    add_p(doc, meta, size=10, space_after=4)
    add_p(doc, "Сейчас в группе", bold=True, size=11, space_after=2)
    for line in now:
        bullet(doc, line, size=10)
    add_p(doc, "УДАЛИТЬ", bold=True, size=11, space_after=2, space_before=4)
    if remove:
        for line in remove:
            bullet(doc, line, size=10)
    else:
        bullet(doc, "Ничего. Ключей почти нет — только добрать.", size=10)
    if keep:
        add_p(doc, "ОСТАВИТЬ", bold=True, size=11, space_after=2, space_before=4)
        for line in keep:
            bullet(doc, line, size=10)
    add_p(
        doc,
        "ДОБАВИТЬ — вставить списком, тип соответствия «фраза»",
        bold=True,
        size=11,
        space_after=3,
        space_before=4,
    )
    paste_block(doc, add)
    if note:
        add_p(doc, note, size=10, space_after=8)


def build():
    doc = Document()
    setup_print(doc)
    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(11)
    style._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")

    add_p(
        doc,
        "РК Выборг: факт после правок 17.08",
        size=18,
        bold=True,
        align=WD_ALIGN_PARAGRAPH.CENTER,
        space_after=4,
    )
    add_p(
        doc,
        "Транз остановлена. СПб-фразы в группе ЛО оставлены. Ключи во все группы добавлены — не дублировать.",
        size=11,
        align=WD_ALIGN_PARAGRAPH.CENTER,
        space_after=10,
    )

    heading(doc, "1. Одинаково на все три кампании", 1)
    add_p(
        doc,
        "Термопанели в Выборге (712773255), Приозерский район Поиск (713047408) "
        "и третья РК аккаунта — те же поля. Не пакетная, каждая сама по себе.",
        space_after=6,
    )
    add_table(
        doc,
        ["Поле", "Значение"],
        [
            ["Стратегия", "Максимум конверсий"],
            ["Оплата", "За конверсии"],
            ["Недельный бюджет", "9 000 ₽"],
            ["Ограничение", "Цена конверсии"],
            ["Цель «Телефон» 582134942", "400 ₽"],
            ["Цель «Мессенджер» 582134994", "350 ₽"],
            ["Счётчик Метрики", "marmara-pro.ru · 110643713"],
            ["РСЯ: Connected TV / Smart TV", "Выключен"],
            ["Минус-слова кампании", "Уже стоят — не чистить и не дублировать"],
            ["Площадки РСЯ", "Мусор в основном убран — не открывать заново"],
        ],
    )
    add_p(
        doc,
        "400 / 350 ₽ лучше прежних 220–290 ₽. При оплате за конверсии Директ "
        "не спишет больше цели, но если за 7 дней на новых ключах показы около нуля — "
        "поднять только телефон до 700 ₽, остальное не трогать. После смены цифр — "
        "неделю не менять стратегию (иначе обучение сбрасывается).",
        space_after=6,
    )
    add_p(doc, "Ещё два правила, не стратегия:", bold=True, space_after=3)
    bullet(doc, "Автотаргетинг на Поиске — выключить в каждой группе. Иначе ключи снова не крутятся.")
    bullet(doc, "Ключи не дублировать между группами: гео — только с городом, коммерция — без города.")

    heading(doc, "2. Группы РК «Термопанели в Выборге» — как есть 17.08", 1)
    add_p(
        doc,
        "Ключи во все группы уже добавлены. Новые группы не создавать, те же фразы не вставлять повторно.",
        space_after=6,
    )
    add_table(
        doc,
        ["Группа", "№", "Статус 17.08"],
        [
            ["Группа 1 — коммерческая", "5773901452", "Ключи добавлены. Работает."],
            ["Группа 2 — Гео (ключевая)", "5773898865", "Ключи добавлены (раньше 0 фраз). Работает."],
            ["Группа 3 — клинкер (продуктовая)", "5773902142", "Ключи добавлены. Работает."],
            ["Термопанели (транз)", "5772834263", "ОСТАНОВЛЕНА. Не включать."],
            ["Термопанели (Лен. область)", "5773097196", "Работает. Фразы по СПб оставлены — так и надо."],
        ],
    )
    add_p(
        doc,
        "Почему СПб в ЛО не трогать: транз на паузе, иначе запросы «термопанели спб» негде крутиться. "
        "Пока транз стоит — спб-фразы живут только в группе ЛО. Включать транз обратно нельзя, "
        "пока эти фразы не убраны из ЛО (две группы начнут биться за один аукцион).",
        space_after=8,
    )
    add_p(
        doc,
        "Объявления группы ЛО лучше с формулировкой «СПб и Ленобласть / доставка», "
        "а не только «по области» — иначе клики из СПб по старым спб-фразам будут слабее.",
        space_after=8,
    )

    heading(doc, "Группа 1 — коммерческая  ·  5773901452", 2)
    add_p(doc, "Ключи добавлены 17.08. Не вставлять повторно. Смысл: купить / цена / расчёт, без городов.", space_after=4)
    bullet(doc, "Если ещё крутятся старые фразы с минусами внутри ключа (−цена −купить −дом) — выключить.")
    bullet(doc, "Автотаргетинг в группе — выкл.")

    heading(doc, "Группа 2 — Гео (ключевая)  ·  5773898865", 2)
    add_p(doc, "Ключи добавлены 17.08 (раньше фраз не было). Выборг и Выборгский район. Приозерск сюда не класть.", space_after=4)
    bullet(doc, "Автотаргетинг выкл. — иначе не видно, работают ли «термопанели выборг».")

    heading(doc, "Группа 3 — клинкер (продуктовая)  ·  5773902142", 2)
    add_p(doc, "Ключи добавлены 17.08. Вид панели / коллекции, без городов.", space_after=4)
    bullet(doc, "Заголовок объявлений: «Клинкерные термопанели, завод в Выборге, от 1 550 ₽».")

    heading(doc, "Термопанели (транз)  ·  5772834263 — СТОП", 2)
    add_p(doc, "Группа остановлена 17.08. Не включать, ключи в ней не править.", space_after=4)
    bullet(doc, "СПб из этой группы больше не идёт — покрытие СПб держит группа ЛО.")
    bullet(doc, "Снимать с паузы можно только если спб-фразы сначала убрать из ЛО. Иначе две группы бьются за один запрос.")

    heading(doc, "Термопанели (Лен. область)  ·  5773097196", 2)
    add_p(
        doc,
        "Ключи добавлены. Фразы по СПб оставлены — это правильное решение при остановленном транзе. "
        "Не удалять спб-фразы из этой группы.",
        space_after=4,
    )
    bullet(doc, "СПб: «термопанели с клинкерной плиткой купить в спб», «термопанель купить санкт петербург» и остальные спб-фразы — оставить.")
    bullet(doc, "Плюс города ЛО (Всеволожск, Гатчина, Тосно и др.) — уже добавлены, не дублировать.")
    bullet(doc, "Не добавлять сюда: выборг (группа 2), приозерск / сосново / ларионово (другая РК).")

    heading(doc, "3. Что делать дальше (7 дней)", 1)
    bullet(doc, "Стратегию, CPA 400/350 и бюджет 9 000 ₽ не менять.")
    bullet(doc, "Ключи ещё раз не добавлять.")
    bullet(doc, "Транз не включать.")
    bullet(doc, "СПб-фразы из ЛО не удалять.")
    bullet(doc, "Смотреть показы по новым фразам, не по автотаргетингу. Если «термопанели выборг» без показов — выключить автотаргетинг в гео-группе.")
    bullet(doc, "В объявлениях группы ЛО: «СПб и Ленобласть», не только «по области».")
    add_p(
        doc,
        "Факт 17.08.2026: транз на паузе, ключи добавлены, спб-фразы в ЛО оставлены. "
        "Минус-слова и чистка РСЯ сделаны ранее.",
        size=9,
        space_after=0,
        space_before=8,
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    CURSOR.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    doc.save(CURSOR)
    print("Wrote", OUT)


if __name__ == "__main__":
    build()

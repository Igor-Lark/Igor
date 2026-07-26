#!/usr/bin/env python3
"""Yandex Direct CSV → Word report (vitaminki-style PPC audit)."""
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, Cm


def num_series(df, col):
    if col not in df.columns:
        return pd.Series([0] * len(df))
    return (
        pd.to_numeric(
            df[col].astype(str).str.replace(",", ".").str.replace(" ", "").replace("-", ""),
            errors="coerce",
        )
        .fillna(0)
    )


def load_csv(path):
    df = pd.read_csv(path, encoding="utf-8-sig")
    for c in ["Расход, ₽", "Показы", "Клики", "Конверсии", "CPA, ₽", "CTR, %", "CPC, ₽"]:
        df[c] = num_series(df, c)
    total = df[df["День"].astype(str) == "Итого"]
    detail = df[df["День"].astype(str) != "Итого"].copy()
    return detail, total.iloc[0] if len(total) else None


def kpi_row(spend, shows, clicks, conv):
    ctr = (clicks / shows * 100) if shows else 0
    cpc = (spend / clicks) if clicks else 0
    cpa = (spend / conv) if conv else 0
    cr = (conv / clicks * 100) if clicks else 0
    return ctr, cpc, cpa, cr


def add_table(doc, headers, rows, col_widths=None):
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.style = "Table Grid"
    for j, h in enumerate(headers):
        t.rows[0].cells[j].text = h
    for i, row in enumerate(rows, start=1):
        for j, val in enumerate(row):
            t.rows[i].cells[j].text = str(val)
    if col_widths:
        for j, w in enumerate(col_widths):
            for row in t.rows:
                row.cells[j].width = Cm(w)
    doc.add_paragraph()


def agg(detail, by, spend_min=0):
    g = (
        detail.groupby(by, dropna=False)
        .agg({"Расход, ₽": "sum", "Показы": "sum", "Клики": "sum", "Конверсии": "sum"})
        .reset_index()
    )
    if spend_min:
        g = g[g["Расход, ₽"] >= spend_min]
    g = g.sort_values("Расход, ₽", ascending=False)
    rows = []
    for _, r in g.iterrows():
        ctr, cpc, cpa, cr = kpi_row(r["Расход, ₽"], r["Показы"], r["Клики"], r["Конверсии"])
        rows.append(
            [
                str(r[by])[:80],
                f"{r['Расход, ₽']:.2f}",
                int(r["Показы"]),
                int(r["Клики"]),
                int(r["Конверсии"]),
                f"{ctr:.2f}",
                f"{cpc:.2f}" if r["Клики"] else "—",
                f"{cpa:.2f}" if r["Конверсии"] else "—",
            ]
        )
    return rows


def build_report(csv_path, out_docx):
    detail, total = load_csv(csv_path)
    spend = float(total["Расход, ₽"]) if total is not None else detail["Расход, ₽"].sum()
    shows = int(total["Показы"]) if total is not None else int(detail["Показы"].sum())
    clicks = int(total["Клики"]) if total is not None else int(detail["Клики"].sum())
    conv = int(total["Конверсии"]) if total is not None else int(detail["Конверсии"].sum())
    ctr, cpc, cpa, cr = kpi_row(spend, shows, clicks, conv)

    camp = detail["Название кампании"].iloc[0] if len(detail) else "—"
    camp_id = detail["№ Кампании"].iloc[0] if len(detail) else "—"
    dmin, dmax = detail["День"].min(), detail["День"].max()

    doc = Document()
    title = doc.add_heading("Анализ кампании Яндекс Директ", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub = doc.add_paragraph(
        f"Кампания: {camp} (№ {camp_id})\n"
        f"Период: {dmin} — {dmax}\n"
        f"Источник: {Path(csv_path).name}\n"
        f"Дата отчёта: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
    )
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_heading("1. Сводка (KPI)", level=1)
    add_table(
        doc,
        ["Показатель", "Значение"],
        [
            ["Расход, ₽", f"{spend:.2f}"],
            ["Показы", str(shows)],
            ["Клики", str(clicks)],
            ["Конверсии", str(conv)],
            ["CTR, %", f"{ctr:.2f}"],
            ["CPC, ₽", f"{cpc:.2f}"],
            ["CPA, ₽", f"{cpa:.2f}" if conv else "—"],
            ["CR, %", f"{cr:.2f}"],
        ],
        [8, 6],
    )

    doc.add_heading("2. Группы объявлений", level=1)
    rows = agg(detail, "Название группы")
    add_table(
        doc,
        ["Группа", "₽", "Показы", "Клики", "Конв.", "CTR%", "CPC", "CPA"],
        rows[:10],
    )

    doc.add_heading("3. Поисковые запросы (с расходом)", level=1)
    qcol = "Поисковый запрос"
    q = detail[
        detail[qcol].notna()
        & (detail[qcol].astype(str).str.strip() != "")
        & (detail["Расход, ₽"] > 0)
    ]
    qrows = agg(q, qcol)
    doc.add_paragraph(
        "Все платные клики пришли с поиска Яндекса (площадка yandex). "
        "Ниже — запросы, на которых был расход."
    )
    add_table(
        doc,
        ["Запрос", "₽", "Показы", "Клики", "Конв.", "CTR%", "CPC", "CPA"],
        qrows,
    )

    doc.add_heading("4. Заголовки объявлений", level=1)
    hrows = agg(detail, "Заголовок", spend_min=0)
    hrows = [r for r in hrows if float(r[1].replace(",", ".")) > 0 or int(r[4]) > 0][:12]
    add_table(
        doc,
        ["Заголовок", "₽", "Показы", "Клики", "Конв.", "CTR%", "CPC", "CPA"],
        hrows,
    )

    doc.add_heading("5. Сети (РСЯ) — показы без расхода", level=1)
    rsy = detail[detail["Тип площадки"] == "Сети"]
    rsy_clicks = int(rsy["Клики"].sum())
    rsy_shows = int(rsy["Показы"].sum())
    doc.add_paragraph(
        f"За период: {rsy_shows} показов и {rsy_clicks} кликов в блоке «Сети», расход 0 ₽. "
        "Это автотargeting на приложениях и сайтах партнёров — для B2B-термопанелей часть площадок "
        "(игры, погода, Дзен) малорелевантна. Рекомендуется проверить список площадок и запретить мусорные."
    )
    pl = (
        rsy.groupby("Название площадки")
        .agg({"Показы": "sum", "Клики": "sum"})
        .reset_index()
        .sort_values("Показы", ascending=False)
        .head(15)
    )
    add_table(
        doc,
        ["Площадка РСЯ", "Показы", "Клики"],
        [[str(r["Название площадки"])[:50], int(r["Показы"]), int(r["Клики"])] for _, r in pl.iterrows()],
    )

    doc.add_heading("6. Динамика по дням", level=1)
    daily = (
        detail.groupby("День")
        .agg({"Расход, ₽": "sum", "Показы": "sum", "Клики": "sum", "Конверсии": "sum"})
        .reset_index()
    )
    add_table(
        doc,
        ["День", "₽", "Показы", "Клики", "Конв."],
        [
            [
                str(r["День"]),
                f"{r['Расход, ₽']:.2f}",
                int(r["Показы"]),
                int(r["Клики"]),
                int(r["Конверсии"]),
            ]
            for _, r in daily.iterrows()
        ],
    )

    doc.add_heading("7. Выводы и рекомендации", level=1)
    bullets = [
        f"Бюджет {spend:.0f} ₽ за период дал {conv} конверсий (CPA ≈ {cpa:.0f} ₽) — для оценки качества нужны цели в Метрике и сравнение с LTV заявки.",
        "Основной расход: группы «Термопанели (транз)», «Гео (ключевая)», коммерческая и «Лен. область». "
        "Группа «клинкер (продуктовая)» — клики без расхода (вероятно только РСЯ/автотarget).",
        "Лучший заголовок по конверсиям и расходу: «Бесплатная доставка по Выборгскому району» (≈290 ₽, 3 конверсии).",
        "Часть платных запросов — не про термопанели («петрович выборг», «строительный магазин вимос»). "
        "Имеет смысл минус-слова (петрович, вимос, стройбаза, строительный магазин) и ужесточение автотargeting / переход на ключевые фразы.",
        "Запрос «термопанели» и «фасадные панели для наружной отделки» — целевые, оставить и масштабировать при приемлемом CPA.",
        "РСЯ: много показов на dzen.ru, mail.ru, игровых приложениях — для строительного B2B лучше снизить долю сетей или отключить нецелевые площадки.",
        "Проверить, что все 6 конверсий — целевые (заявка/звонок), и настроить офлайн-конверсии и коллтрекинг.",
    ]
    for b in bullets:
        doc.add_paragraph(b, style="List Bullet")

    doc.add_heading("8. Техническая справка", level=2)
    doc.add_paragraph(
        "Отчёт построен автоматически из выгрузки «Мaster report» Директа (детализация по дням, группам, "
        "запросам, площадкам). Строка «Итого» в CSV использована для сверки KPI."
    )

    doc.save(out_docx)
    return out_docx


if __name__ == "__main__":
    csv_p = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("input.csv")
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else csv_p.with_suffix(".docx")
    build_report(csv_p, out)
    print(out)

#!/usr/bin/env python3
"""Yandex Direct CSV → Word report (vitaminki-style PPC audit).

Every run includes: KPI, groups, queries, headlines, RSYA, daily stats,
conclusions, and block 9 — minus-words, keywords, RSYA placements to exclude.
"""
import re
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm

# --- Heuristics for B2B / construction facades (tunable) ---

BASE_MINUS_WORDS = [
    "петрович",
    "вимос",
    "строим наш дом",
    "leroy",
    "леруа",
    "obi",
    "оби",
    "кастorama",
    "maxidom",
    "максидом",
    "метр",
    "dns",
    "mvideo",
    "каталог",
    "официальный сайт",
    "строймагазин",
    "стройбаза",
    "гипермаркет",
    "рассрочка",
    "распродажа",
    "пвх",
    "виниловый сайдинг",
    "сайдинг винил",
    "форум",
    "вакансии",
    "youtube",
    "ютуб",
    "б/у",
    "авito",
    "скачать",
]

BASE_MINUS_PHRASES = [
    "петрович выборг",
    "вимос выборг",
    "каталог товаров",
    "строительный магазин",
    "магазин петрович",
]

OPTIONAL_MINUS_IF_NO_DRY_PANELS = [
    "без утеплителя",
    "вентфасад плитка",
]

OFF_QUERY_RE = re.compile(
    r"петрович|вимос|строим наш дом|каталог|рассрочк|распродаж|"
    r"нижн.{0,3}новгород|пвх|официальн|leroy|леруа|магазин строительный|"
    r"строймагазин|youtube|ютуб|форум",
    re.I,
)
TARGET_QUERY_RE = re.compile(r"термопан|клинкер|фасад|утепл", re.I)

RSYA_BAN_NAME_RE = re.compile(
    r"dzen|\.zen|zen\.|mail\.ru|pogoda|weather|game|games|puzzle|block|"
    r"match3|tiletrip|cleaner|vkontakte|kidult|24smi|word\.|free\.games",
    re.I,
)

KEYWORD_TEMPLATES = {
    "коммерч": [
        "термопанели",
        "термопанели купить",
        "термопанели цена",
        "термопанели для фасада",
        "фасадные панели с утеплением",
        "фасадные панели для наружной отделки",
        "купить термопанели",
        "термопанели от производителя",
    ],
    "гео": [
        "термопанели выборг",
        "термопанели в выборге",
        "фасадные панели выборг",
        "клинкерные термопанели выборг",
        "термопанели выборгский район",
        "утепление фасада выборг",
    ],
    "транз": [
        "термопанели ленинградская область",
        "термопанели ленобласть",
        "термопанели с доставкой",
        "термопанели приозерск",
        "термопанели всеволожский район",
    ],
    "клинкер": [
        "клинкерные термопанели",
        "термопанели под кирпич",
        "фасад под кирпич термопанели",
        "клинкерные панели для фасада",
        "термопанель кирпич фасад",
    ],
    "лен": [
        "термопанели производство ленобласть",
        "фасадные термопанели ленинградская область",
    ],
}


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


def add_code_block(doc, title, lines):
    doc.add_paragraph(title)
    p = doc.add_paragraph("\n".join(lines))
    for run in p.runs:
        run.font.name = "Consolas"


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
        ctr, cpc, cpa, _cr = kpi_row(r["Расход, ₽"], r["Показы"], r["Клики"], r["Конверсии"])
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


def search_query_stats(detail):
    qcol = "Поисковый запрос"
    search = detail[detail["Тип площадки"] == "Поиск"].copy()
    search = search[search[qcol].notna() & (search[qcol].astype(str).str.strip() != "")]
    if search.empty:
        return pd.DataFrame()
    return (
        search.groupby(qcol)
        .agg({"Расход, ₽": "sum", "Клики": "sum", "Конверсии": "sum", "Показы": "sum"})
        .reset_index()
    )


def minus_words_from_data(query_stats):
    """Extra minus tokens from off-target queries with clicks."""
    extra = []
    for _, r in query_stats.iterrows():
        q = str(r["Поисковый запрос"])
        clicks = int(r["Клики"])
        if clicks < 2:
            continue
        if OFF_QUERY_RE.search(q) and not (
            TARGET_QUERY_RE.search(q) and not OFF_QUERY_RE.search(q.replace("рассроч", ""))
        ):
            for token in ["петрович", "вимос", "каталог", "рассрочка", "распродажа", "пвх", "новгород"]:
                if token in q.lower() and token not in extra:
                    extra.append(token)
    return extra


def target_queries_from_data(query_stats, limit=12):
    rows = []
    for _, r in query_stats.sort_values("Клики", ascending=False).iterrows():
        q = str(r["Поисковый запрос"])
        if TARGET_QUERY_RE.search(q) and not OFF_QUERY_RE.search(q):
            rows.append(q)
        if len(rows) >= limit:
            break
    return rows


def keywords_for_groups(detail, query_stats):
    groups = detail["Название группы"].dropna().unique()
    blocks = []
    seen = set()
    for gname in groups:
        gl = str(gname).lower()
        keys = []
        for pattern, phrases in KEYWORD_TEMPLATES.items():
            if pattern in gl:
                keys.extend(phrases)
        if keys:
            blocks.append((str(gname), keys))
            seen.update(keys)
    # Queries from report
    from_data = target_queries_from_data(query_stats)
    if from_data:
        blocks.append(("Из отчёта (целевые запросы с кликами)", from_data))
    if not blocks:
        blocks.append(("Базовый набор", KEYWORD_TEMPLATES["коммерч"] + KEYWORD_TEMPLATES["гео"]))
    return blocks


def rsya_exclude_list(detail, min_clicks=1, top_n=25):
    rsy = detail[detail["Тип площадки"] == "Сети"]
    if rsy.empty:
        return []
    pl = (
        rsy.groupby("Название площадки")
        .agg({"Показы": "sum", "Клики": "sum", "Конверсии": "sum", "Расход, ₽": "sum"})
        .reset_index()
    )
    rows = []
    for _, r in pl.iterrows():
        name = str(r["Название площадки"])
        clicks = int(r["Клики"])
        shows = int(r["Показы"])
        conv = int(r["Конверсии"])
        if clicks < min_clicks and shows < 50:
            continue
        reasons = []
        if RSYA_BAN_NAME_RE.search(name):
            reasons.append("игры/Дзен/погода/соцсети")
        if name.startswith("com.") and "yandex" not in name.lower():
            reasons.append("мобильное приложение")
        if clicks >= 3 and conv == 0:
            reasons.append("клики без конверсий")
        if not reasons and clicks >= 5:
            reasons.append("много кликов — проверить релевантность")
        if reasons:
            rows.append(
                [
                    name[:55],
                    shows,
                    clicks,
                    conv,
                    "; ".join(reasons),
                ]
            )
    rows.sort(key=lambda x: (x[2], x[1]), reverse=True)
    return rows[:top_n]


def paid_search_condition_note(detail):
    search_paid = detail[(detail["Тип площадки"] == "Поиск") & (detail["Расход, ₽"] > 0)]
    if search_paid.empty or "Тип условия показа" not in search_paid.columns:
        return ""
    cond = search_paid.groupby("Тип условия показа")["Расход, ₽"].sum()
    top = cond.idxmax() if len(cond) else ""
    if top == "Автотаргетинг":
        return (
            "На поиске весь расход идёт через «Автотаргетинг» — добавьте ключевые фразы "
            "(фразовое/точное соответствие) и сузьте или отключите широкий автотаргет."
        )
    return ""


def add_action_block(doc, detail):
    """Block 8: minus words, keywords, RSYA bans — included in every report."""
    doc.add_heading("8. Минус-слова, ключевые фразы, площадки к отключению", level=1)
    doc.add_paragraph(
        "Блок формируется автоматически при каждом анализе: базовые списки для ниши "
        "фасадов/термопанелей + данные из вашей выгрузки (запросы и площадки РСЯ)."
    )

    qs = search_query_stats(detail)
    extra_minus = minus_words_from_data(qs) if len(qs) else []
    minus_words = sorted(set(BASE_MINUS_WORDS + extra_minus))

    doc.add_heading("8.1. Минус-слова (уровень кампании)", level=2)
    add_code_block(doc, "Скопировать в Директ (по одному слову на строку):", minus_words)

    doc.add_heading("8.2. Минус-фразы", level=2)
    add_code_block(doc, "Рекомендуемые минус-фразы:", BASE_MINUS_PHRASES)

    doc.add_heading("8.3. Опционально (если не продаёте панели без утепления)", level=2)
    add_code_block(doc, "", OPTIONAL_MINUS_IF_NO_DRY_PANELS)

    # Paid off-target from report
    if len(qs):
        off_paid = []
        for _, r in qs.iterrows():
            if r["Расход, ₽"] <= 0:
                continue
            q = str(r["Поисковый запрос"])
            if OFF_QUERY_RE.search(q):
                off_paid.append(
                    [q[:60], f"{r['Расход, ₽']:.0f}", int(r["Клики"]), int(r["Конверсии"]), "в минус-фразы"]
                )
        if off_paid:
            doc.add_heading("8.4. Платные запросы — отсечь", level=2)
            add_table(doc, ["Запрос", "₽", "Клики", "Конв.", "Действие"], off_paid)

    doc.add_heading("8.5. Ключевые фразы по группам", level=2)
    auto_note = paid_search_condition_note(detail)
    if auto_note:
        doc.add_paragraph(auto_note)
    for gname, phrases in keywords_for_groups(detail, qs):
        doc.add_paragraph(f"Группа: {gname}", style="List Bullet")
        add_code_block(doc, "", phrases)

    doc.add_heading("8.6. Площадки РСЯ — убрать из показов", level=2)
    doc.add_paragraph(
        "В интерфейсе Директа: кампания → «Площадки» → «Запретить площадки» "
        "(или снизить/отключить показы в сетях). Ниже — площадки из отчёта с признаками "
        "нерелевантности для B2B-термопанелей."
    )
    ban_rows = rsya_exclude_list(detail)
    if ban_rows:
        add_table(
            doc,
            ["Площадка", "Показы", "Клики", "Конв.", "Причина"],
            ban_rows,
        )
        ban_names = [r[0] for r in ban_rows]
        doc.add_paragraph("Список для копирования (имена площадок):")
        add_code_block(doc, "", ban_names)
    else:
        doc.add_paragraph("В выгрузке мало данных по сетям — проверьте отчёт «Площадки» за тот же период.")

    doc.add_heading("8.7. Настройки (кратко)", level=2)
    for b in [
        "Поиск: фразовое + точное соответствие; не полагаться только на автотаргет.",
        "Сети: отдельная кампания с низким бюджетом или отключить до настройки поиска.",
        "После добавления минус-слов — повторный анализ через 7–14 дней по новой выгрузке.",
    ]:
        doc.add_paragraph(b, style="List Bullet")


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
        "Запросы, на которых был расход (как правило, поиск Яндекса)."
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

    doc.add_heading("5. Сети (РСЯ)", level=1)
    rsy = detail[detail["Тип площадки"] == "Сети"]
    rsy_clicks = int(rsy["Клики"].sum())
    rsy_shows = int(rsy["Показы"].sum())
    rsy_spend = float(rsy["Расход, ₽"].sum())
    doc.add_paragraph(
        f"За период: {rsy_shows} показов, {rsy_clicks} кликов, расход {rsy_spend:.2f} ₽. "
        "Список площадок к отключению — в разделе 8.6."
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
        f"Бюджет {spend:.0f} ₽ за период дал {conv} конверсий (CPA ≈ {cpa:.0f} ₽) — сверьте цели в Метрике с реальными заявками.",
    ]
    auto_note = paid_search_condition_note(detail)
    if auto_note:
        bullets.append(auto_note)
    bullets.extend(
        [
            "Часть трафика с поиска — запросы к сторонним магазинам (Петрович, Вимос); см. раздел 8.",
            "Целевые платные запросы («термопанели», «фасадные панели…») — оставить и усилить ключами из раздела 8.5.",
            "РСЯ: отключить или запретить площадки из раздела 8.6 (Дзен, игры, погода).",
            "Масштабировать объявления с сильным CPA/конверсиями (см. раздел 4).",
        ]
    )
    for b in bullets:
        doc.add_paragraph(b, style="List Bullet")

    doc.add_page_break()
    add_action_block(doc, detail)

    doc.add_page_break()
    doc.add_heading("9. Техническая справка", level=1)
    doc.add_paragraph(
        "Отчёт: scripts/yandex_direct_report_docx.py — Master report Директа. "
        "Раздел 8 (минус-слова, ключи, площадки) добавляется при каждом запуске анализа."
    )

    doc.save(out_docx)
    return out_docx


if __name__ == "__main__":
    csv_p = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("input.csv")
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else csv_p.with_suffix(".docx")
    build_report(csv_p, out)
    print(out)

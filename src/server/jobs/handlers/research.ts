import { getDb } from "../../db/client";
import { newId, nowIso } from "../../ids";
import { parseModelJson, systemRules, LlmNotConfiguredError } from "../../llm/client";
import { SearchNotConfiguredError } from "../../research/search";
import { asStringList, hostnameOf, isSiteHost } from "../../text";
import { finishTask } from "../finish";
import type { Handler } from "../types";
import { UrlPolicyError } from "../../http/ssrf";

type Fact = { statement: string; sourceUrls?: string[] };
type ModelReport = {
  summary?: string;
  confirmedFacts?: Fact[];
  contradictions?: Fact[];
  uncertainties?: string[];
  recommendations?: Array<{ statement?: string; isHypothesis?: boolean }>;
  applicationNotes?: string;
};

type SavedSource = { id: string; url: string; title: string; excerpt: string; unavailable: boolean };

const NO_SOURCES = "Источники не получены. Отчёт не создан, чтобы не заполнять его предположениями.";

export const handleResearch: Handler = async (task, ctx) => {
  if (!task.directionId) throw new Error("Исследование не привязано к направлению.");
  const goal = String(task.input.goal || task.description || "").trim();
  if (!goal) throw new Error("Не указана цель исследования.");
  const queries = asStringList(task.input.queries).slice(0, 3);
  const seedUrls = asStringList(task.input.seedUrls);
  ctx.progress(10, "Собираю адреса источников");
  const urls = new Set<string>();
  const warnings: string[] = [];

  for (const raw of seedUrls) {
    ctx.checkpoint();
    if (isSiteHost(raw)) {
      warnings.push(`${raw} — страница boat-sochi.ru. Она не загружается модулем внешних источников. Если есть снимок, он будет приложен отдельно.`);
      continue;
    }
    urls.add(raw);
  }

  if (queries.length) {
    if (!ctx.search.configured()) {
      warnings.push(new SearchNotConfiguredError().message);
    } else {
      for (const query of queries) {
        ctx.checkpoint();
        ctx.progress(25, `Ищу: ${query}`);
        try {
          const hits = await ctx.search.search(query, 5);
          if (!hits.length) warnings.push(`По запросу «${query}» поиск не вернул ссылок.`);
          for (const hit of hits) {
            if (!hit.url || isSiteHost(hit.url)) continue;
            urls.add(hit.url);
          }
        } catch (error) {
          if (error instanceof SearchNotConfiguredError) warnings.push(error.message);
          else throw error;
        }
      }
    }
  }

  const saved: SavedSource[] = [];
  const siteSnapshot = task.pageId
    ? (getDb()
        .prepare(
          `SELECT s.text_content, s.fetched_at, s.title_tag, p.url, p.title
           FROM page_snapshots s JOIN pages p ON p.id = s.page_id
           WHERE s.page_id = ? ORDER BY s.fetched_at DESC LIMIT 1`,
        )
        .get(task.pageId) as
        | { text_content: string; fetched_at: string; title_tag: string; url: string; title: string }
        | undefined)
    : undefined;
  if (siteSnapshot?.text_content) {
    saved.push(
      saveSource(task, {
        title: siteSnapshot.title_tag || siteSnapshot.title,
        url: siteSnapshot.url,
        publisher: "boat-sochi.ru",
        publishedAt: null,
        sourceType: "site_page",
        excerpt: siteSnapshot.text_content.slice(0, 5000),
        unavailable: false,
        reliability: "medium",
        reliabilityNote: "Это текст страницы самого сайта из сохранённого снимка, а не независимый источник.",
        accessedAt: siteSnapshot.fetched_at,
      }),
    );
  }

  const list = [...urls].slice(0, 8);
  let index = 0;
  for (const url of list) {
    index += 1;
    ctx.checkpoint();
    ctx.progress(30 + Math.round((index / Math.max(list.length, 1)) * 40), `Читаю источник ${index} из ${list.length}`);
    try {
      const document = await ctx.fetchExternal(url, ctx.signal);
      const unavailable = document.httpStatus >= 400 || document.text.trim().length === 0;
      saved.push(
        saveSource(task, {
          title: document.title || url,
          url: document.finalUrl || url,
          publisher: hostnameOf(document.finalUrl || url),
          publishedAt: document.publishedAt,
          sourceType: "unconfirmed",
          excerpt: unavailable ? "" : document.text.slice(0, 5000),
          unavailable,
          reliability: "unknown",
          reliabilityNote: unavailable
            ? "Источник недоступен или пуст. Утверждения из него не делались."
            : "Тип источника автоматически не присвоен: публикация в интернете сама по себе не подтверждает факт.",
          accessedAt: nowIso(),
        }),
      );
      if (unavailable) warnings.push(`Источник недоступен или пуст: ${url}`);
    } catch (error) {
      const message = error instanceof UrlPolicyError ? error.message : error instanceof Error ? error.message : "ошибка загрузки";
      saved.push(
        saveSource(task, {
          title: url,
          url,
          publisher: hostnameOf(url),
          publishedAt: null,
          sourceType: "unconfirmed",
          excerpt: "",
          unavailable: true,
          reliability: "unknown",
          reliabilityNote: `Источник не получен: ${message}`,
          accessedAt: nowIso(),
        }),
      );
      warnings.push(`Не удалось получить ${url}: ${message}`);
    }
  }

  const usable = saved.filter((item) => !item.unavailable && item.excerpt.trim());
  if (!usable.length) {
    for (const warning of warnings) ctx.warn(warning);
    throw new Error(NO_SOURCES);
  }

  ctx.checkpoint();
  const previous = findPrevious(task.directionId, goal, String(task.input.previousReportId || ""));
  let summary = "";
  let facts: Fact[] = [];
  let contradictions: Fact[] = [];
  let uncertainties: string[] = [];
  let recommendations: Array<{ statement: string; isHypothesis: boolean }> = [];
  let applicationNotes = "";
  let mode: "llm" | "excerpts_only" = "excerpts_only";

  if (!ctx.llm.configured()) {
    mode = "excerpts_only";
    summary = "Связный отчёт не составлялся: LLM не настроена. Сохранены только фрагменты полученных источников. Это не выводы и не рекомендации.";
    uncertainties = ["Для выводов, противоречий и рекомендаций нужен настроенный LLM. Пробелы не заполнялись."];
    warnings.push("LLM не настроена, синтез выводов не выполнялся.");
  } else {
    ctx.progress(80, "Собираю отчёт по полученным источникам");
    try {
      const raw = await ctx.llm.complete({
        system: systemRules(
          "Верни JSON: summary, confirmedFacts[{statement, sourceUrls}], contradictions[{statement, sourceUrls}], uncertainties[], recommendations[{statement, isHypothesis}], applicationNotes. sourceUrls бери только из переданных источников. Не добавляй фактов, которых нет в фрагментах.",
        ),
        user: JSON.stringify({
          goal,
          sources: usable.map((item) => ({ url: item.url, title: item.title, excerpt: item.excerpt.slice(0, 3500) })),
        }),
        json: true,
        signal: ctx.signal,
      });
      const parsed = parseModelJson<ModelReport>(raw);
      const allowed = new Set(usable.map((item) => item.url));
      facts = sanitizeFacts(parsed.confirmedFacts || [], allowed, warnings);
      contradictions = sanitizeFacts(parsed.contradictions || [], allowed, warnings);
      uncertainties = (parsed.uncertainties || []).map((item) => String(item).trim()).filter(Boolean);
      recommendations = (parsed.recommendations || [])
        .map((item) => ({ statement: String(item.statement || "").trim(), isHypothesis: item.isHypothesis !== false }))
        .filter((item) => item.statement);
      summary = String(parsed.summary || "").trim();
      applicationNotes = String(parsed.applicationNotes || "").trim();
      if (!summary) {
        summary = "Модель не сформулировала краткий вывод. Ниже только те пункты, которые удалось разобрать из ответа.";
        warnings.push("Краткий вывод модели пуст.");
      }
      mode = "llm";
    } catch (error) {
      if (error instanceof LlmNotConfiguredError) throw error;
      throw new Error(`Отчёт не создан: ${error instanceof Error ? error.message : "сбой LLM"}. Фрагменты источников сохранены.`);
    }
  }

  const reportId = newId();
  const conductedAt = nowIso();
  const changes = describeChanges(previous, usable.map((item) => item.url), summary);
  getDb()
    .prepare(
      `INSERT INTO research_reports (
        id, task_id, direction_id, page_id, previous_report_id, goal, conducted_at, summary,
        confirmed_facts_json, contradictions_json, uncertainties_json, recommendations_json,
        application_notes, changes_vs_previous, synthesis_mode, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      reportId,
      task.id,
      task.directionId,
      task.pageId,
      previous?.id ?? null,
      goal,
      conductedAt,
      summary,
      JSON.stringify(facts),
      JSON.stringify(contradictions),
      JSON.stringify(uncertainties),
      JSON.stringify(recommendations),
      applicationNotes,
      changes,
      mode,
      conductedAt,
    );
  const linkReport = getDb().prepare("INSERT OR IGNORE INTO report_sources (report_id, source_id) VALUES (?, ?)");
  for (const source of usable) linkReport.run(reportId, source.id);
  storeFindings(reportId, "fact", facts.map((item) => ({ statement: item.statement, hypothesis: false, urls: item.sourceUrls || [] })), saved);
  storeFindings(reportId, "contradiction", contradictions.map((item) => ({ statement: item.statement, hypothesis: false, urls: item.sourceUrls || [] })), saved);
  storeFindings(reportId, "uncertainty", uncertainties.map((statement) => ({ statement, hypothesis: false, urls: [] })), saved);
  storeFindings(reportId, "recommendation", recommendations.map((item) => ({ statement: item.statement, hypothesis: item.isHypothesis, urls: [] })), saved);
  for (const warning of warnings) ctx.warn(warning);
  finishTask(task.id, "awaiting_review", {
    kind: "research",
    reportId,
    summary,
    synthesisMode: mode,
  }, warnings);
};

function sanitizeFacts(facts: Fact[], allowed: Set<string>, warnings: string[]): Fact[] {
  return facts
    .map((fact) => {
      const urls = (fact.sourceUrls || []).filter((url) => allowed.has(url));
      const dropped = (fact.sourceUrls || []).filter((url) => !allowed.has(url));
      if (dropped.length) warnings.push("Из ответа модели убраны ссылки, которых не было среди полученных источников.");
      return { statement: String(fact.statement || "").trim(), sourceUrls: urls };
    })
    .filter((fact) => fact.statement && fact.sourceUrls && fact.sourceUrls.length > 0);
}

function saveSource(
  task: { id: string; directionId: string | null; pageId: string | null },
  input: {
    title: string;
    url: string | null;
    publisher: string | null;
    publishedAt: string | null;
    sourceType: string;
    excerpt: string;
    unavailable: boolean;
    reliability: string;
    reliabilityNote: string;
    accessedAt: string;
  },
): SavedSource {
  const id = newId();
  const db = getDb();
  db.prepare(
    `INSERT INTO sources (
      id, title, url, publisher, published_at, accessed_at, source_type, summary, reliability,
      reliability_note, review_status, unavailable, excerpt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unreviewed', ?, ?, ?)`,
  ).run(
    id,
    input.title.slice(0, 300),
    input.url,
    input.publisher,
    input.publishedAt,
    input.accessedAt,
    input.sourceType,
    input.excerpt.slice(0, 500),
    input.reliability,
    input.reliabilityNote,
    input.unavailable ? 1 : 0,
    input.excerpt,
    input.accessedAt,
  );
  db.prepare("INSERT OR IGNORE INTO task_sources (task_id, source_id) VALUES (?, ?)").run(task.id, id);
  if (task.directionId) {
    db.prepare("INSERT OR IGNORE INTO source_directions (source_id, direction_id) VALUES (?, ?)").run(id, task.directionId);
  }
  if (task.pageId) db.prepare("INSERT OR IGNORE INTO source_pages (source_id, page_id) VALUES (?, ?)").run(id, task.pageId);
  return { id, url: input.url || "", title: input.title, excerpt: input.excerpt, unavailable: input.unavailable };
}

function findPrevious(directionId: string, goal: string, explicitId: string): { id: string; summary: string; sourceUrls: string[] } | null {
  const db = getDb();
  const row = explicitId
    ? (db.prepare("SELECT id, summary FROM research_reports WHERE id = ?").get(explicitId) as { id: string; summary: string } | undefined)
    : (db
        .prepare(
          "SELECT id, summary FROM research_reports WHERE direction_id = ? AND goal = ? ORDER BY conducted_at DESC LIMIT 1",
        )
        .get(directionId, goal) as { id: string; summary: string } | undefined);
  if (!row) return null;
  const sources = db
    .prepare(
      `SELECT s.url FROM sources s
       JOIN report_sources rs ON rs.source_id = s.id
       WHERE rs.report_id = ? AND s.url IS NOT NULL`,
    )
    .all(row.id) as Array<{ url: string }>;
  return { id: row.id, summary: row.summary, sourceUrls: sources.map((item) => item.url) };
}

function describeChanges(
  previous: { summary: string; sourceUrls: string[] } | null,
  nextUrls: string[],
  nextSummary: string,
): string {
  if (!previous) return "Предыдущего отчёта с этой целью нет.";
  const before = new Set(previous.sourceUrls);
  const after = new Set(nextUrls);
  const added = [...after].filter((url) => !before.has(url));
  const removed = [...before].filter((url) => !after.has(url));
  return [
    `Новые адреса: ${added.length ? added.join(", ") : "нет"}.`,
    `Адреса только в прошлом отчёте: ${removed.length ? removed.join(", ") : "нет"}.`,
    `Прошлый краткий вывод: ${previous.summary || "пуст"}.`,
    `Новый краткий вывод: ${nextSummary || "пуст"}.`,
    "Смысловое сравнение сверх этого списка не выполнялось.",
  ].join("\n");
}

function storeFindings(
  reportId: string,
  kind: string,
  items: Array<{ statement: string; hypothesis: boolean; urls: string[] }>,
  sources: SavedSource[],
): void {
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO research_findings (id, report_id, kind, statement, is_hypothesis) VALUES (?, ?, ?, ?, ?)",
  );
  const link = db.prepare("INSERT OR IGNORE INTO finding_sources (finding_id, source_id) VALUES (?, ?)");
  for (const item of items) {
    const id = newId();
    insert.run(id, reportId, kind, item.statement, item.hypothesis ? 1 : 0);
    for (const url of item.urls) {
      const source = sources.find((entry) => entry.url === url);
      if (source) link.run(id, source.id);
    }
  }
}

import { getDb, parseJson } from "../../db/client";
import { newId, nowIso } from "../../ids";
import { systemRules } from "../../llm/client";
import { analyzeSeo } from "../../seo/rules";
import { asStringList } from "../../text";
import { finishTask } from "../finish";
import type { Handler } from "../types";

export const handleSeo: Handler = async (task, ctx) => {
  if (!task.pageId) throw new Error("Не выбрана страница.");
  const snapshot = getDb()
    .prepare(
      `SELECT id, title_tag, meta_description, h1, headings_json, text_content, links_json, incomplete
       FROM page_snapshots WHERE page_id = ? ORDER BY fetched_at DESC LIMIT 1`,
    )
    .get(task.pageId) as
    | {
        id: string;
        title_tag: string;
        meta_description: string;
        h1: string;
        headings_json: string;
        text_content: string;
        links_json: string;
        incomplete: number;
      }
    | undefined;
  if (!snapshot) throw new Error("Нет снимка страницы. SEO-анализ не выполнен.");
  const others = getDb()
    .prepare(
      `SELECT p.url, p.title, s.h1 FROM pages p
       LEFT JOIN page_snapshots s ON s.id = (
         SELECT id FROM page_snapshots WHERE page_id = p.id ORDER BY fetched_at DESC LIMIT 1
       )
       WHERE p.id != ?`,
    )
    .all(task.pageId) as Array<{ url: string; title: string; h1: string | null }>;
  const queries = asStringList(task.input.queries);
  const analysis = analyzeSeo({
    title: snapshot.title_tag,
    description: snapshot.meta_description,
    h1: snapshot.h1,
    headings: parseJson(snapshot.headings_json, []),
    text: snapshot.text_content,
    links: parseJson(snapshot.links_json, []),
    queries,
    otherPages: others.map((page) => ({ title: page.title, h1: page.h1 || "", url: page.url })),
  });
  const warnings = [...task.warnings];
  if (snapshot.incomplete) warnings.push("Снимок неполный. Выводы относятся только к полученному тексту.");
  let llmNotes = "";
  if (ctx.llm.configured()) {
    ctx.checkpoint();
    ctx.progress(60, "Добавляю комментарий модели к правилам SEO");
    try {
      llmNotes = await ctx.llm.complete({
        system: systemRules("Кратко прокомментируй уже найденные пункты. Не добавляй частотность, позиции и прогноз трафика. Если данных мало, так и напиши."),
        user: JSON.stringify({ findings: analysis.findings, textSample: snapshot.text_content.slice(0, 4000) }),
        signal: ctx.signal,
      });
    } catch (error) {
      warnings.push(`Комментарий модели не получен: ${error instanceof Error ? error.message : "ошибка"}. Правильный разбор снимка сохранён.`);
    }
  } else {
    warnings.push("LLM не настроена. Сохранён только разбор снимка правилами, без текстовых рекомендаций модели.");
  }
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO seo_analyses (
        id, page_id, direction_id, task_id, snapshot_id, conducted_at, preliminary, findings_json, queries_json, notes, llm_notes
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    )
    .run(
      id,
      task.pageId,
      task.directionId,
      task.id,
      snapshot.id,
      nowIso(),
      JSON.stringify(analysis.findings),
      JSON.stringify(queries),
      "Показатели спроса и позиций не запрашивались. Все выводы предварительные.",
      llmNotes,
    );
  for (const warning of warnings) ctx.warn(warning);
  finishTask(task.id, "awaiting_review", {
    kind: "seo_analysis",
    analysisId: id,
    summary: `Пунктов: ${analysis.findings.length}. Вывод предварительный.`,
  }, warnings);
};

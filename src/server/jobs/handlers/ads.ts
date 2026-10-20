import { LENGTH_GUIDE } from "@/lib/labels";
import { getDb } from "../../db/client";
import { newId, nowIso } from "../../ids";
import { LlmNotConfiguredError, parseModelJson, systemRules } from "../../llm/client";
import { asStringList } from "../../text";
import { finishTask } from "../finish";
import type { Handler } from "../types";

type AdJson = {
  headlines?: string[];
  extraHeadlines?: string[];
  texts?: string[];
  shortVariants?: string[];
  ctas?: string[];
  idea?: string;
  hypotheses?: string[];
  visualNotes?: string[];
  warnings?: string[];
};

export const handleAdCopy: Handler = async (task, ctx) => {
  if (!task.directionId) throw new Error("Рекламная задача не привязана к направлению.");
  const name = String(task.input.name || task.title).trim();
  const conceptId = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO advertising_concepts (
        id, direction_id, page_id, task_id, name, goal, audience, season_label, offer, hypothesis,
        key_argument, format, constraints, visual_notes, approval_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'draft', ?, ?)`,
    )
    .run(
      conceptId,
      task.directionId,
      task.pageId,
      task.id,
      name,
      String(task.input.goal || ""),
      String(task.input.audience || ""),
      String(task.input.season || ""),
      String(task.input.offer || ""),
      String(task.input.hypothesis || ""),
      String(task.input.keyArgument || ""),
      String(task.input.format || ""),
      String(task.input.constraints || ""),
      now,
      now,
    );
  if (task.input.mode === "manual") {
    const copyId = saveCopy(conceptId, task.id, {
      headlines: asStringList(task.input.headlines),
      extraHeadlines: asStringList(task.input.extraHeadlines),
      texts: asStringList(task.input.texts),
      shortVariants: asStringList(task.input.shortVariants),
      ctas: asStringList(task.input.ctas),
      idea: String(task.input.idea || ""),
      hypotheses: asStringList(task.input.hypotheses),
      warnings: [LENGTH_GUIDE],
      origin: "user",
    });
    finishTask(task.id, "awaiting_review", { kind: "ad_copy", conceptId, copyId, summary: "Сохранены тексты, введённые пользователем." }, [LENGTH_GUIDE]);
    return;
  }
  if (!ctx.llm.configured()) {
    throw new LlmNotConfiguredError("LLM не настроена. Бриф концепции сохранён, тексты объявлений не генерировались.");
  }
  ctx.checkpoint();
  ctx.progress(40, "Готовлю варианты объявлений");
  const direction = getDb().prepare("SELECT name, description FROM service_directions WHERE id = ?").get(task.directionId) as {
    name: string;
    description: string;
  };
  const facts = getDb()
    .prepare("SELECT label, value, confirmed FROM commercial_facts WHERE direction_id = ?")
    .all(task.directionId) as Array<{ label: string; value: string; confirmed: number }>;
  const raw = await ctx.llm.complete({
    system: systemRules(
      `Сделай объявления именно для направления «${direction.name}». Не переноси аргументы других услуг. Верни JSON: headlines, extraHeadlines, texts, shortVariants, ctas, idea, hypotheses, visualNotes, warnings. ${LENGTH_GUIDE} Не выдумывай цены и наличие. Гипотезы помещай только в hypotheses.`,
    ),
    user: JSON.stringify({
      direction: direction.name,
      directionNote: direction.description,
      brief: task.input,
      commercialFacts: facts.map((fact) => ({ ...fact, confirmed: fact.confirmed === 1 })),
    }),
    json: true,
    signal: ctx.signal,
  });
  const parsed = parseModelJson<AdJson>(raw);
  const warnings = [...asStringList(parsed.warnings), LENGTH_GUIDE];
  const copy = {
    headlines: asStringList(parsed.headlines),
    extraHeadlines: asStringList(parsed.extraHeadlines),
    texts: asStringList(parsed.texts),
    shortVariants: asStringList(parsed.shortVariants),
    ctas: asStringList(parsed.ctas),
    idea: String(parsed.idea || ""),
    hypotheses: asStringList(parsed.hypotheses).map((item) => (item.startsWith("Гипотеза") ? item : `Гипотеза: ${item}`)),
    warnings,
  };
  if (!copy.headlines.length || !copy.texts.length) {
    throw new Error("Модель не вернула заголовки и тексты. Объявления не сохранены, бриф концепции остался.");
  }
  lengthWarnings(copy.headlines, 56, "Заголовок", warnings);
  lengthWarnings(copy.extraHeadlines, 30, "Дополнительный заголовок", warnings);
  lengthWarnings(copy.texts, 81, "Текст", warnings);
  const copyId = saveCopy(conceptId, task.id, { ...copy, origin: "llm" });
  if (parsed.visualNotes) {
    getDb().prepare("UPDATE advertising_concepts SET visual_notes = ?, updated_at = ? WHERE id = ?").run(
      asStringList(parsed.visualNotes).join("\n"),
      nowIso(),
      conceptId,
    );
  }
  for (const warning of warnings) ctx.warn(warning);
  finishTask(task.id, "awaiting_review", { kind: "ad_copy", conceptId, copyId, summary: copy.idea || "Варианты объявлений готовы к проверке." }, warnings);
};

function lengthWarnings(values: string[], limit: number, label: string, warnings: string[]) {
  for (const value of values) {
    if (value.length > limit) warnings.push(`${label} длиннее ориентира ${limit}: ${value.length} символов.`);
  }
}

function saveCopy(
  conceptId: string,
  taskId: string,
  copy: {
    headlines: string[];
    extraHeadlines: string[];
    texts: string[];
    shortVariants: string[];
    ctas: string[];
    idea: string;
    hypotheses: string[];
    warnings: string[];
    origin: string;
  },
): string {
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO ad_copy_versions (
        id, concept_id, task_id, parent_version_id, headlines_json, extra_headlines_json, texts_json,
        short_variants_json, ctas_json, idea, hypotheses_json, warnings_json, approval_status, origin, created_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'in_review', ?, ?)`,
    )
    .run(
      id,
      conceptId,
      taskId,
      JSON.stringify(copy.headlines),
      JSON.stringify(copy.extraHeadlines),
      JSON.stringify(copy.texts),
      JSON.stringify(copy.shortVariants),
      JSON.stringify(copy.ctas),
      copy.idea,
      JSON.stringify(copy.hypotheses),
      JSON.stringify(copy.warnings),
      copy.origin,
      nowIso(),
    );
  return id;
}

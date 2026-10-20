import { getDb } from "../../db/client";
import { newId, nowIso } from "../../ids";
import { systemRules } from "../../llm/client";
import { assemblePrompt, type PromptFields } from "../../prompts/build";
import { finishTask } from "../finish";
import type { Handler } from "../types";

export const handleImagePrompt: Handler = async (task, ctx) => {
  if (!task.directionId) throw new Error("Промпт не привязан к направлению.");
  const fields: PromptFields = {
    purpose: String(task.input.purpose || ""),
    targetFormat: String(task.input.targetFormat || ""),
    subject: String(task.input.subject || ""),
    composition: String(task.input.composition || ""),
    angle: String(task.input.angle || ""),
    environment: String(task.input.environment || ""),
    lighting: String(task.input.lighting || ""),
    weather: String(task.input.weather || ""),
    season: String(task.input.season || ""),
    textSpace: String(task.input.textSpace || ""),
    realism: String(task.input.realism || "фотореалистично"),
    constraints: String(task.input.constraints || ""),
    referenceNote: String(task.input.referenceNote || ""),
  };
  if (!fields.subject?.trim()) throw new Error("Не указан основной объект изображения. Промпт не собран.");
  let promptText = assemblePrompt(fields);
  let origin = "structured";
  const warnings: string[] = [];
  if (task.input.refineWithLlm) {
    if (!ctx.llm.configured()) {
      warnings.push("Уточнение моделью не выполнено: LLM не настроена. Сохранён промпт, собранный из полей.");
    } else {
      ctx.checkpoint();
      try {
        const refined = await ctx.llm.complete({
          system: systemRules("Уточни промпт для генератора изображений. Не добавляй характеристики и цены, которых нет в исходном тексте. Верни только текст промпта."),
          user: promptText,
          signal: ctx.signal,
        });
        if (refined.trim()) {
          promptText = refined.trim();
          origin = "llm";
        }
      } catch (error) {
        warnings.push(`Уточнение моделью не выполнено: ${error instanceof Error ? error.message : "ошибка"}. Сохранён промпт из полей.`);
      }
    }
  }
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO image_prompts (
        id, direction_id, concept_id, page_id, task_id, name, purpose, target_format, subject, composition,
        angle, environment, lighting, weather, season, text_space, realism, constraints, reference_note,
        prompt_text, origin, approval_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_review', ?, ?)`,
    )
    .run(
      id,
      task.directionId,
      task.input.conceptId || null,
      task.pageId,
      task.id,
      String(task.input.name || task.title),
      fields.purpose,
      fields.targetFormat,
      fields.subject,
      fields.composition,
      fields.angle,
      fields.environment,
      fields.lighting,
      fields.weather,
      fields.season,
      fields.textSpace,
      fields.realism,
      fields.constraints,
      fields.referenceNote,
      promptText,
      origin,
      now,
      now,
    );
  for (const warning of warnings) ctx.warn(warning);
  finishTask(task.id, "awaiting_review", { kind: "image_prompt", promptId: id, summary: "Промпт сохранён.", origin }, warnings);
};

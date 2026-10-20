import fs from "fs";
import path from "path";
import { EXPERT_SCORE_DISCLAIMER } from "@/lib/labels";
import { getDb } from "../../db/client";
import { dataDir } from "../../db/paths";
import { newId, nowIso } from "../../ids";
import { parseModelJson, systemRules } from "../../llm/client";
import { finishTask } from "../finish";
import type { Handler } from "../types";

type Criterion = {
  id: string;
  title: string;
  score?: number;
  fact?: string;
  explanation: string;
  issues: string[];
  recommendations: string[];
};

const CRITERIA = [
  ["subject", "Видимость основного объекта"],
  ["composition", "Композиция"],
  ["text", "Читаемость текста"],
  ["contrast", "Контраст текста и фона"],
  ["offer", "Понятность предложения"],
  ["audience", "Соответствие аудитории"],
  ["realism", "Реалистичность"],
  ["concept", "Соответствие концепции"],
  ["landing", "Соответствие посадочной странице"],
  ["distraction", "Отвлекающие элементы"],
  ["season", "Сезонное оформление"],
  ["format", "Пригодность для формата"],
];

export const handleCreativeReview: Handler = async (task, ctx) => {
  const assetId = String(task.input.assetId || "");
  const asset = getDb().prepare("SELECT * FROM creative_assets WHERE id = ?").get(assetId) as
    | {
        id: string;
        name: string;
        mime: string;
        byte_size: number;
        width: number | null;
        height: number | null;
        storage_path: string;
        format_label: string;
        direction_id: string | null;
        concept_id: string | null;
        page_id: string | null;
        user_comment: string;
      }
    | undefined;
  if (!asset) throw new Error("Креатив не найден.");
  const ratio = asset.width && asset.height ? asset.width / asset.height : null;
  const technical: Criterion[] = [
    {
      id: "file",
      title: "Файл",
      fact: `${asset.mime}, ${asset.byte_size} байт, ${asset.width || "?"}×${asset.height || "?"}`,
      explanation: "Это свойства файла, а не оценка рекламного качества.",
      issues: [],
      recommendations: [],
    },
  ];
  if (ratio && asset.format_label.includes("1:1") && Math.abs(ratio - 1) > 0.08) {
    technical.push({
      id: "format-mismatch",
      title: "Формат",
      fact: `Заявлено «${asset.format_label}», соотношение сторон ${ratio.toFixed(2)}.`,
      explanation: "Фактическая пропорция заметно отличается от квадрата.",
      issues: ["Пропорция не совпадает с заявленным квадратным форматом."],
      recommendations: ["Проверить кадрирование перед загрузкой в кабинет."],
    });
  }
  const technicalId = saveReview(asset.id, task.id, {
    mode: "technical_only",
    criteria: technical,
    overall: "Сохранены только технические свойства файла.",
    strengths: [],
    weaknesses: [],
    critical: [],
    recommendations: [],
    recheck: false,
    unavailableReason: ctx.llm.visionConfigured() ? null : "Экспертный разбор изображения недоступен: не задан OPENAI_VISION_MODEL.",
  });
  if (!ctx.llm.visionConfigured()) {
    const reason = "Экспертные оценки не выставлены: модель со зрением не настроена.";
    ctx.warn(reason);
    finishTask(task.id, "awaiting_review", {
      kind: "creative_review",
      reviewId: technicalId,
      summary: reason,
      mode: "technical_only",
    }, [reason]);
    return;
  }
  ctx.checkpoint();
  ctx.progress(40, "Разбираю изображение моделью");
  const file = fs.readFileSync(path.join(dataDir(), asset.storage_path));
  let parsed: {
    criteria?: Criterion[];
    strengths?: string[];
    weaknesses?: string[];
    critical?: string[];
    recommendations?: string[];
    recheck?: boolean;
    overall?: string;
    recognizedText?: string;
  };
  try {
    const raw = await ctx.llm.complete({
      system: systemRules(
        `Оцени креатив по критериям: ${CRITERIA.map(([id, title]) => `${id}=${title}`).join(", ")}. Верни JSON: criteria[{id,title,score,explanation,issues,recommendations}], strengths, weaknesses, critical, recommendations, recheck, overall, recognizedText. score от 1 до 10 и только как экспертная оценка. recognizedText — отдельно распознанный текст, не вывод о читаемости. Не предсказывай CTR и продажи.`,
      ),
      user: `Название: ${asset.name}. Формат: ${asset.format_label}. Комментарий пользователя: ${asset.user_comment}. Размер: ${asset.width}×${asset.height}.`,
      image: { mime: asset.mime, base64: file.toString("base64") },
      json: true,
      signal: ctx.signal,
    });
    parsed = parseModelJson(raw);
  } catch (error) {
    throw new Error(`Визуальный разбор не выполнен: ${error instanceof Error ? error.message : "ошибка"}. Технические свойства файла сохранены, оценки не выдумывались.`);
  }
  const criteria: Criterion[] = (parsed.criteria || [])
    .map((item) => ({
      id: String(item.id || ""),
      title: String(item.title || item.id || ""),
      score: clampScore(item.score),
      explanation: String(item.explanation || ""),
      issues: asList(item.issues),
      recommendations: asList(item.recommendations),
    }))
    .filter((item) => item.id && item.score);
  if (!criteria.length) {
    throw new Error("Модель не вернула объяснённых оценок. Фиктивная шкала не подставлена. Технический разбор сохранён.");
  }
  if (parsed.recognizedText) {
    criteria.unshift({
      id: "ocr",
      title: "Распознанный текст",
      explanation: `Распознанный текст, отдельно от вывода о читаемости: ${parsed.recognizedText}`,
      issues: [],
      recommendations: [],
    });
  }
  const reviewId = saveReview(asset.id, task.id, {
    mode: "vision",
    criteria,
    overall: String(parsed.overall || ""),
    strengths: asList(parsed.strengths),
    weaknesses: asList(parsed.weaknesses),
    critical: asList(parsed.critical),
    recommendations: asList(parsed.recommendations),
    recheck: Boolean(parsed.recheck),
    unavailableReason: null,
  });
  finishTask(task.id, "awaiting_review", {
    kind: "creative_review",
    reviewId,
    technicalReviewId: technicalId,
    summary: parsed.overall || "Экспертный разбор сохранён.",
    mode: "vision",
  }, [EXPERT_SCORE_DISCLAIMER]);
};

function clampScore(value: unknown): number | undefined {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 10) return undefined;
  return score;
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function saveReview(
  assetId: string,
  taskId: string,
  review: {
    mode: string;
    criteria: Criterion[];
    overall: string;
    strengths: string[];
    weaknesses: string[];
    critical: string[];
    recommendations: string[];
    recheck: boolean;
    unavailableReason: string | null;
  },
): string {
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO creative_reviews (
        id, asset_id, task_id, conducted_at, mode, criteria_json, overall_note, strengths_json,
        weaknesses_json, critical_json, recommendations_json, recheck_recommended, unavailable_reason, disclaimer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      assetId,
      taskId,
      nowIso(),
      review.mode,
      JSON.stringify(review.criteria),
      review.overall,
      JSON.stringify(review.strengths),
      JSON.stringify(review.weaknesses),
      JSON.stringify(review.critical),
      JSON.stringify(review.recommendations),
      review.recheck ? 1 : 0,
      review.unavailableReason,
      review.mode === "vision" ? EXPERT_SCORE_DISCLAIMER : "Технический разбор не оценивает рекламное качество и не предсказывает результат кампании.",
    );
  return id;
}

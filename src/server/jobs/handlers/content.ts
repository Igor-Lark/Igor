import { getDb, parseJson } from "../../db/client";
import { findUnsourcedPrices } from "../../content/prices";
import { newId, nowIso } from "../../ids";
import { LlmNotConfiguredError, parseModelJson, systemRules } from "../../llm/client";
import { finishTask } from "../finish";
import type { Handler } from "../types";

type Proposal = {
  title?: string;
  body?: string;
  titleTag?: string;
  metaDescription?: string;
  reason?: string;
  changeExplanation?: string;
};

export const handleContentProposal: Handler = async (task, ctx) => {
  if (!task.pageId) throw new Error("Не выбрана страница.");
  const snapshot = getDb()
    .prepare(
      `SELECT id, text_content, title_tag, meta_description, h1, incomplete
       FROM page_snapshots WHERE page_id = ? ORDER BY fetched_at DESC LIMIT 1`,
    )
    .get(task.pageId) as
    | { id: string; text_content: string; title_tag: string; meta_description: string; h1: string; incomplete: number }
    | undefined;
  if (!snapshot || !snapshot.text_content.trim()) {
    throw new Error("Нет текста снимка страницы. Предложение не создано.");
  }
  const originalId = newId();
  const createdAt = nowIso();
  getDb()
    .prepare(
      `INSERT INTO content_versions (
        id, page_id, direction_id, task_id, parent_version_id, kind, origin, title, body,
        title_tag, meta_description, reason, change_explanation, sources_json, approval_status, created_at
      ) VALUES (?, ?, ?, ?, NULL, 'original', 'snapshot', ?, ?, ?, ?, ?, '', '[]', 'draft', ?)`,
    )
    .run(
      originalId,
      task.pageId,
      task.directionId,
      task.id,
      snapshot.h1 || snapshot.title_tag,
      snapshot.text_content,
      snapshot.title_tag,
      snapshot.meta_description,
      "Исходный текст из последнего снимка страницы.",
      createdAt,
    );
  if (!ctx.llm.configured()) {
    throw new LlmNotConfiguredError("LLM не настроена. Исходная версия сохранена, предложенный текст не создавался.");
  }
  ctx.checkpoint();
  ctx.progress(40, "Готовлю предложение по тексту страницы");
  const materials = collectMaterials(task.directionId, task.pageId, String(task.input.researchReportId || ""));
  const raw = await ctx.llm.complete({
    system: systemRules(
      "Верни JSON с полями title, body, titleTag, metaDescription, reason, changeExplanation. Не меняй коммерческие условия. Если факт не подтверждён, не включай его в текст и напиши об этом в changeExplanation. Не гарантируй улов, дельфинов и рост заявок.",
    ),
    user: JSON.stringify({
      instruction: String(task.input.instruction || task.description || ""),
      snapshot: {
        title: snapshot.title_tag,
        description: snapshot.meta_description,
        h1: snapshot.h1,
        incomplete: snapshot.incomplete === 1,
        text: snapshot.text_content.slice(0, 12000),
      },
      ...materials,
    }),
    json: true,
    signal: ctx.signal,
  });
  const proposal = parseModelJson<Proposal>(raw);
  const body = String(proposal.body || "").trim();
  if (!body) throw new Error("Модель не вернула текст предложения. Новая версия не сохранена.");
  const corpus = [snapshot.text_content, materials.corpus].join("\n");
  const prices = findUnsourcedPrices(body, corpus);
  const warnings = [...task.warnings];
  if (snapshot.incomplete) warnings.push("Снимок страницы помечен как неполный. Предложение опирается только на полученный текст.");
  if (prices.length) warnings.push(`В предложении есть цены, которых нет в исходных материалах: ${prices.join(", ")}. Их нужно убрать или подтвердить.`);
  if (materials.unconfirmed) warnings.push("В контексте были неподтверждённые коммерческие условия. Их нельзя публиковать как утверждённые.");
  const proposalId = newId();
  getDb()
    .prepare(
      `INSERT INTO content_versions (
        id, page_id, direction_id, task_id, parent_version_id, kind, origin, title, body,
        title_tag, meta_description, reason, change_explanation, sources_json, approval_status, created_at
      ) VALUES (?, ?, ?, ?, ?, 'proposal', 'llm', ?, ?, ?, ?, ?, ?, ?, 'in_review', ?)`,
    )
    .run(
      proposalId,
      task.pageId,
      task.directionId,
      task.id,
      originalId,
      String(proposal.title || snapshot.h1 || "").trim(),
      body,
      String(proposal.titleTag || "").trim(),
      String(proposal.metaDescription || "").trim(),
      String(proposal.reason || "").trim(),
      String(proposal.changeExplanation || "").trim(),
      JSON.stringify(materials.sourceRefs),
      nowIso(),
    );
  for (const warning of warnings) ctx.warn(warning);
  finishTask(task.id, "awaiting_review", { kind: "content_proposal", originalId, proposalId, summary: proposal.reason || "Предложение готово к проверке." }, warnings);
};

function collectMaterials(directionId: string | null, pageId: string, reportId: string) {
  const db = getDb();
  const facts = db
    .prepare(
      `SELECT label, value, confirmed, source_note FROM commercial_facts
       WHERE direction_id IS NULL OR direction_id = ? OR page_id = ?`,
    )
    .all(directionId, pageId) as Array<{ label: string; value: string; confirmed: number; source_note: string }>;
  const observations = db
    .prepare("SELECT observed_on, author_label, body FROM user_observations WHERE direction_id IS NULL OR direction_id = ?")
    .all(directionId) as Array<{ observed_on: string; author_label: string; body: string }>;
  const notes = db
    .prepare("SELECT title, body FROM knowledge_notes WHERE scope = 'site' OR direction_id = ?")
    .all(directionId) as Array<{ title: string; body: string }>;
  let report: { id: string; summary: string; goal: string } | undefined;
  if (reportId) {
    report = db.prepare("SELECT id, summary, goal FROM research_reports WHERE id = ? AND direction_id = ?").get(reportId, directionId) as
      | { id: string; summary: string; goal: string }
      | undefined;
  } else if (pageId) {
    const rows = db
      .prepare("SELECT id, summary, goal FROM research_reports WHERE page_id = ? ORDER BY conducted_at DESC")
      .all(pageId) as Array<{ id: string; summary: string; goal: string }>;
    if (rows.length === 1) report = rows[0];
  }
  const sourceRefs = report
    ? (db
        .prepare(
          `SELECT s.id, s.title, s.url FROM sources s
           JOIN report_sources rs ON rs.source_id = s.id WHERE rs.report_id = ?`,
        )
        .all(report.id) as Array<{ id: string; title: string; url: string | null }>)
    : [];
  const corpus = [
    ...facts.map((fact) => fact.value),
    ...observations.map((item) => item.body),
    ...notes.map((item) => item.body),
    report?.summary || "",
  ].join("\n");
  return {
    commercialFacts: facts.map((fact) => ({ ...fact, confirmed: fact.confirmed === 1 })),
    observations: observations.map((item) => ({ ...item, kind: "user_observation" })),
    notes,
    research: report || null,
    sourceRefs,
    corpus,
    unconfirmed: facts.some((fact) => fact.confirmed === 0),
  };
}

export function listContentVersions(pageId?: string) {
  const rows = pageId
    ? getDb().prepare("SELECT * FROM content_versions WHERE page_id = ? ORDER BY created_at DESC").all(pageId)
    : getDb().prepare("SELECT * FROM content_versions ORDER BY created_at DESC").all();
  return (rows as Array<Record<string, unknown>>).map(mapVersion);
}

export function getContentVersion(id: string) {
  const row = getDb().prepare("SELECT * FROM content_versions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapVersion(row) : null;
}

function mapVersion(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    pageId: String(row.page_id),
    directionId: row.direction_id ? String(row.direction_id) : null,
    taskId: row.task_id ? String(row.task_id) : null,
    parentVersionId: row.parent_version_id ? String(row.parent_version_id) : null,
    kind: String(row.kind),
    origin: String(row.origin),
    title: String(row.title || ""),
    body: String(row.body || ""),
    titleTag: String(row.title_tag || ""),
    metaDescription: String(row.meta_description || ""),
    reason: String(row.reason || ""),
    changeExplanation: String(row.change_explanation || ""),
    sources: parseJson(String(row.sources_json || "[]"), []),
    approvalStatus: String(row.approval_status),
    createdAt: String(row.created_at),
  };
}

import { logActivity } from "../db/activity";
import { getDb } from "../db/client";
import { newId, nowIso } from "../ids";
import { addTaskEvent, patchTask } from "../tasks/store";

const DECISIONS = new Set(["in_review", "needs_revision", "approved", "rejected"]);

const TABLES: Record<string, { table: string; taskColumn?: string }> = {
  content_version: { table: "content_versions", taskColumn: "task_id" },
  ad_concept: { table: "advertising_concepts", taskColumn: "task_id" },
  ad_copy: { table: "ad_copy_versions", taskColumn: "task_id" },
  image_prompt: { table: "image_prompts", taskColumn: "task_id" },
};

export function decideMaterial(input: {
  targetType: string;
  targetId: string;
  decision: string;
  comment?: string;
}): void {
  if (!DECISIONS.has(input.decision)) throw new Error("Неизвестное решение.");
  const meta = TABLES[input.targetType];
  if (!meta) throw new Error("Неизвестный тип материала.");
  const row = getDb().prepare(`SELECT id, approval_status FROM ${meta.table} WHERE id = ?`).get(input.targetId) as
    | { id: string; approval_status: string }
    | undefined;
  if (!row) throw new Error("Материал не найден.");
  const at = nowIso();
  getDb().prepare(`UPDATE ${meta.table} SET approval_status = ? WHERE id = ?`).run(input.decision, input.targetId);
  if (meta.table === "advertising_concepts" || meta.table === "image_prompts") {
    getDb().prepare(`UPDATE ${meta.table} SET updated_at = ? WHERE id = ?`).run(at, input.targetId);
  }
  getDb()
    .prepare("INSERT INTO approval_events (id, target_type, target_id, decision, comment, at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(newId(), input.targetType, input.targetId, input.decision, input.comment?.trim() || "", at);
  logActivity({
    action: "approval",
    entityType: input.targetType,
    entityId: input.targetId,
    message: `Решение «${input.decision}» сохранено внутри приложения. Сайт и рекламный кабинет не изменялись.`,
  });
  if (!meta.taskColumn) return;
  const linked = getDb().prepare(`SELECT ${meta.taskColumn} AS task_id FROM ${meta.table} WHERE id = ?`).get(input.targetId) as
    | { task_id: string | null }
    | undefined;
  if (!linked?.task_id) return;
  const taskStatus = input.decision === "approved" ? "approved" : input.decision === "in_review" ? "awaiting_review" : "needs_revision";
  const task = getDb().prepare("SELECT status FROM tasks WHERE id = ?").get(linked.task_id) as { status: string } | undefined;
  if (!task || ["running", "queued", "cancelled"].includes(task.status)) return;
  patchTask(linked.task_id, { status: taskStatus, needsReview: taskStatus !== "approved" });
  addTaskEvent(linked.task_id, "approval", `Пользователь поставил решению материала статус «${input.decision}». Внешние системы не вызывались.`);
}

export function saveUserContentVersion(input: {
  parentVersionId: string;
  body: string;
  reason?: string;
  title?: string;
  titleTag?: string;
  metaDescription?: string;
}): string {
  const parent = getDb().prepare("SELECT * FROM content_versions WHERE id = ?").get(input.parentVersionId) as
    | Record<string, unknown>
    | undefined;
  if (!parent) throw new Error("Исходная версия не найдена.");
  const body = input.body.trim();
  if (!body) throw new Error("Пустой текст не сохранён.");
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO content_versions (
        id, page_id, direction_id, task_id, parent_version_id, kind, origin, title, body, title_tag,
        meta_description, reason, change_explanation, sources_json, approval_status, created_at
      ) VALUES (?, ?, ?, ?, ?, 'proposal', 'user', ?, ?, ?, ?, ?, 'Версия введена пользователем и не считается согласованной автоматически.', ?, 'draft', ?)`,
    )
    .run(
      id,
      parent.page_id,
      parent.direction_id,
      parent.task_id,
      parent.id,
      input.title?.trim() || parent.title,
      body,
      input.titleTag?.trim() || "",
      input.metaDescription?.trim() || "",
      input.reason?.trim() || "Доработка пользователя.",
      parent.sources_json || "[]",
      nowIso(),
    );
  return id;
}

export function addObservation(input: {
  directionId?: string | null;
  pageId?: string | null;
  observedOn: string;
  periodLabel?: string;
  authorLabel?: string;
  body: string;
}): string {
  const body = input.body.trim();
  if (!body) throw new Error("Опишите наблюдение.");
  if (!input.observedOn) throw new Error("Укажите дату наблюдения.");
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO user_observations (id, direction_id, page_id, observed_on, period_label, author_label, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.directionId || null, input.pageId || null, input.observedOn, input.periodLabel || "", input.authorLabel || "", body, nowIso());
  logActivity({
    action: "observation",
    entityType: "observation",
    entityId: id,
    message: "Добавлено пользовательское наблюдение. Оно не смешивается с независимыми источниками.",
    directionId: input.directionId || null,
  });
  return id;
}

export function confirmFact(id: string): void {
  const fact = getDb().prepare("SELECT id, direction_id, label FROM commercial_facts WHERE id = ?").get(id) as
    | { id: string; direction_id: string | null; label: string }
    | undefined;
  if (!fact) throw new Error("Условие не найдено.");
  getDb().prepare("UPDATE commercial_facts SET confirmed = 1, updated_at = ? WHERE id = ?").run(nowIso(), id);
  logActivity({
    action: "confirm_fact",
    entityType: "commercial_fact",
    entityId: id,
    message: `Пользователь подтвердил условие «${fact.label}». Значение не изменялось.`,
    directionId: fact.direction_id,
  });
}

export function addFact(input: { directionId?: string | null; pageId?: string | null; kind: string; label: string; value: string; sourceNote: string }): string {
  if (!input.label.trim() || !input.value.trim() || !input.sourceNote.trim()) {
    throw new Error("Нужны название, значение и откуда оно известно.");
  }
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO commercial_facts (id, direction_id, page_id, kind, label, value, source_note, source_url, confirmed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)`,
    )
    .run(id, input.directionId || null, input.pageId || null, input.kind || "other", input.label.trim(), input.value.trim(), input.sourceNote.trim(), now, now);
  return id;
}

export function linkSourceToDirection(sourceId: string, directionId: string): void {
  const source = getDb().prepare("SELECT id FROM sources WHERE id = ?").get(sourceId);
  const direction = getDb().prepare("SELECT id FROM service_directions WHERE id = ?").get(directionId);
  if (!source || !direction) throw new Error("Источник или направление не найдены.");
  getDb().prepare("INSERT OR IGNORE INTO source_directions (source_id, direction_id) VALUES (?, ?)").run(sourceId, directionId);
}

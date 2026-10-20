import type { TaskStatus, TaskType } from "@/lib/labels";
import { newId, nowIso } from "../ids";
import { getDb, parseJson } from "../db/client";

export type TaskRecord = {
  id: string;
  directionId: string | null;
  pageId: string | null;
  parentTaskId: string | null;
  type: TaskType;
  title: string;
  description: string;
  status: TaskStatus;
  input: Record<string, unknown>;
  progress: number;
  progressLabel: string;
  partialResult: unknown;
  result: unknown;
  errorMessage: string | null;
  warnings: string[];
  needsReview: boolean;
  control: string | null;
  scheduledFor: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
};

type TaskRow = {
  id: string;
  direction_id: string | null;
  page_id: string | null;
  parent_task_id: string | null;
  type: TaskType;
  title: string;
  description: string;
  status: TaskStatus;
  input_json: string;
  progress: number;
  progress_label: string;
  partial_result_json: string | null;
  result_json: string | null;
  error_message: string | null;
  warnings_json: string;
  needs_review: number;
  control: string | null;
  scheduled_for: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

export function mapTask(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    directionId: row.direction_id,
    pageId: row.page_id,
    parentTaskId: row.parent_task_id,
    type: row.type,
    title: row.title,
    description: row.description,
    status: row.status,
    input: parseJson(row.input_json, {}),
    progress: row.progress,
    progressLabel: row.progress_label,
    partialResult: parseJson(row.partial_result_json, null),
    result: parseJson(row.result_json, null),
    errorMessage: row.error_message,
    warnings: parseJson(row.warnings_json, []),
    needsReview: row.needs_review === 1,
    control: row.control,
    scheduledFor: row.scheduled_for,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    updatedAt: row.updated_at,
  };
}

export function getTask(id: string): TaskRecord | null {
  const row = getDb().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
  return row ? mapTask(row) : null;
}

export function mustGetTask(id: string): TaskRecord {
  const task = getTask(id);
  if (!task) throw new Error("Задача не найдена.");
  return task;
}

export function insertTask(task: TaskRecord): void {
  getDb()
    .prepare(
      `INSERT INTO tasks (
        id, direction_id, page_id, parent_task_id, type, title, description, status, input_json,
        progress, progress_label, partial_result_json, result_json, error_message, warnings_json,
        needs_review, control, scheduled_for, created_at, started_at, finished_at, updated_at
      ) VALUES (
        @id, @directionId, @pageId, @parentTaskId, @type, @title, @description, @status, @input,
        @progress, @progressLabel, @partial, @result, @errorMessage, @warnings,
        @needsReview, @control, @scheduledFor, @createdAt, @startedAt, @finishedAt, @updatedAt
      )`,
    )
    .run({
      id: task.id,
      directionId: task.directionId,
      pageId: task.pageId,
      parentTaskId: task.parentTaskId,
      type: task.type,
      title: task.title,
      description: task.description,
      status: task.status,
      input: JSON.stringify(task.input),
      progress: task.progress,
      progressLabel: task.progressLabel,
      partial: task.partialResult == null ? null : JSON.stringify(task.partialResult),
      result: task.result == null ? null : JSON.stringify(task.result),
      errorMessage: task.errorMessage,
      warnings: JSON.stringify(task.warnings),
      needsReview: task.needsReview ? 1 : 0,
      control: task.control,
      scheduledFor: task.scheduledFor,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
      updatedAt: task.updatedAt,
    });
}

export function patchTask(
  id: string,
  fields: Partial<{
    status: TaskStatus;
    progress: number;
    progressLabel: string;
    partialResult: unknown;
    result: unknown;
    errorMessage: string | null;
    warnings: string[];
    needsReview: boolean;
    control: string | null;
    startedAt: string | null;
    finishedAt: string | null;
  }>,
): void {
  const sets: string[] = [];
  const values: Record<string, unknown> = { id, updatedAt: nowIso() };
  const mapping: Array<[keyof typeof fields, string, (value: unknown) => unknown]> = [
    ["status", "status", (value) => value],
    ["progress", "progress", (value) => value],
    ["progressLabel", "progress_label", (value) => value],
    ["partialResult", "partial_result_json", (value) => (value == null ? null : JSON.stringify(value))],
    ["result", "result_json", (value) => (value == null ? null : JSON.stringify(value))],
    ["errorMessage", "error_message", (value) => value],
    ["warnings", "warnings_json", (value) => JSON.stringify(value)],
    ["needsReview", "needs_review", (value) => (value ? 1 : 0)],
    ["control", "control", (value) => value],
    ["startedAt", "started_at", (value) => value],
    ["finishedAt", "finished_at", (value) => value],
  ];
  for (const [key, column, encode] of mapping) {
    if (key in fields) {
      sets.push(`${column} = @${key}`);
      values[key] = encode(fields[key]);
    }
  }
  sets.push("updated_at = @updatedAt");
  getDb().prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = @id`).run(values);
}

export function addTaskEvent(taskId: string, kind: string, message: string, data?: unknown): void {
  getDb()
    .prepare("INSERT INTO task_events (id, task_id, at, kind, message, data_json) VALUES (?, ?, ?, ?, ?, ?)")
    .run(newId(), taskId, nowIso(), kind, message, data == null ? null : JSON.stringify(data));
}

export function listTaskEvents(taskId: string): Array<{ id: string; at: string; kind: string; message: string }> {
  return getDb()
    .prepare("SELECT id, at, kind, message FROM task_events WHERE task_id = ? ORDER BY at ASC")
    .all(taskId) as Array<{ id: string; at: string; kind: string; message: string }>;
}

export function addTaskComment(taskId: string, body: string): void {
  getDb()
    .prepare("INSERT INTO task_comments (id, task_id, at, body) VALUES (?, ?, ?, ?)")
    .run(newId(), taskId, nowIso(), body.trim());
}

export function listTaskComments(taskId: string): Array<{ id: string; at: string; body: string }> {
  return getDb()
    .prepare("SELECT id, at, body FROM task_comments WHERE task_id = ? ORDER BY at ASC")
    .all(taskId) as Array<{ id: string; at: string; body: string }>;
}

export type TaskFilters = {
  directionId?: string;
  type?: string;
  status?: string;
  query?: string;
  sort?: "created" | "updated";
};

export function listTasks(filters: TaskFilters = {}): TaskRecord[] {
  const where: string[] = [];
  const params: Record<string, string> = {};
  if (filters.directionId) {
    where.push("direction_id = @directionId");
    params.directionId = filters.directionId;
  }
  if (filters.type) {
    where.push("type = @type");
    params.type = filters.type;
  }
  if (filters.status) {
    where.push("status = @status");
    params.status = filters.status;
  }
  if (filters.query) {
    where.push("title LIKE @query");
    params.query = `%${filters.query.replace(/[%_]/g, "")}%`;
  }
  const order = filters.sort === "updated" ? "updated_at DESC" : "created_at DESC";
  const sql = `SELECT * FROM tasks ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order}`;
  return (getDb().prepare(sql).all(params) as TaskRow[]).map(mapTask);
}

export function updateProgress(id: string, progress: number, label: string, partial?: unknown): void {
  patchTask(id, {
    progress,
    progressLabel: label,
    ...(partial !== undefined ? { partialResult: partial } : {}),
  });
}

export function readControl(id: string): string | null {
  const row = getDb().prepare("SELECT control FROM tasks WHERE id = ?").get(id) as { control: string | null } | undefined;
  return row?.control ?? null;
}

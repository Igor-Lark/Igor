import type { TaskType } from "@/lib/labels";
import { logError } from "../log";
import { nowIso } from "../ids";
import { logActivity } from "../db/activity";
import { getDb } from "../db/client";
import { defaultLlm } from "../llm/client";
import { fetchExternalPage, fetchSitePage } from "../http/pages";
import { defaultSearch } from "../research/search";
import { addTaskEvent, mustGetTask, patchTask, readControl, updateProgress } from "../tasks/store";
import { handlers as defaultHandlers } from "./handlers";
import { ControlError, type Handler, type JobContext, type JobDeps } from "./types";

const globalState = globalThis as typeof globalThis & {
  __bcfRunner?: { timer: NodeJS.Timeout | null; active: Map<string, AbortController> };
};

function runtime() {
  if (!globalState.__bcfRunner) {
    globalState.__bcfRunner = { timer: null, active: new Map() };
  }
  return globalState.__bcfRunner;
}

export function recoverInterruptedTasks(): number {
  const db = getDb();
  const rows = db.prepare("SELECT id FROM tasks WHERE status = 'running'").all() as Array<{ id: string }>;
  let count = 0;
  for (const row of rows) {
    if (runtime().active.has(row.id)) continue;
    const at = nowIso();
    patchTask(row.id, {
      status: "interrupted",
      errorMessage: "Выполнение прервано перезапуском. Задача не запускалась повторно.",
      finishedAt: at,
      control: null,
    });
    addTaskEvent(row.id, "interrupted", "Приложение остановилось во время выполнения. Внешние вызовы заново не выполнялись.");
    count += 1;
  }
  return count;
}

export function startJobRunner(): void {
  const state = runtime();
  if (state.timer) return;
  recoverInterruptedTasks();
  const interval = Number(process.env.BCF_POLL_MS || 1000);
  state.timer = setInterval(() => {
    try {
      void Promise.all(pumpQueue()).catch((error: unknown) => logError("queue", error));
    } catch (error) {
      logError("queue", error);
    }
  }, interval);
  state.timer.unref?.();
}

export function stopJobRunner(): void {
  const state = runtime();
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}

export function pumpQueue(deps: JobDeps = {}): Promise<void>[] {
  const max = Math.max(1, Number(process.env.BCF_MAX_CONCURRENT_TASKS || 2));
  const state = runtime();
  const db = getDb();
  const at = nowIso();
  db.prepare(
    `UPDATE tasks SET status = 'queued', updated_at = ?
     WHERE status = 'scheduled' AND scheduled_for IS NOT NULL AND scheduled_for <= ?`,
  ).run(at, at);
  const started: Promise<void>[] = [];
  while (state.active.size < max) {
    const next = db.prepare("SELECT id FROM tasks WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1").get() as
      | { id: string }
      | undefined;
    if (!next) break;
    const claim = db
      .prepare(
        `UPDATE tasks SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ?, control = NULL
         WHERE id = ? AND status = 'queued'`,
      )
      .run(at, at, next.id);
    if (claim.changes !== 1) continue;
    const abort = new AbortController();
    state.active.set(next.id, abort);
    const job = runClaimed(next.id, abort, deps).finally(() => state.active.delete(next.id));
    started.push(job);
  }
  return started;
}

async function runClaimed(id: string, abort: AbortController, deps: JobDeps): Promise<void> {
  addTaskEvent(id, "running", "Выполнение начато.");
  const warnings: string[] = [...mustGetTask(id).warnings];
  try {
    const task = mustGetTask(id);
    const handler: Handler | undefined = deps.handlers?.[task.type] ?? defaultHandlers[task.type as TaskType];
    if (!handler) throw new Error(`Для типа «${task.type}» нет обработчика.`);
    await handler(task, makeContext(id, abort, deps, warnings));
    const after = mustGetTask(id);
    if (after.status === "running") {
      patchTask(id, {
        status: "error",
        errorMessage: "Обработчик завершился, не сохранив итог.",
        finishedAt: nowIso(),
      });
      addTaskEvent(id, "error", "Обработчик не установил статус.");
    }
  } catch (error) {
    const control = readControl(id);
    const action = error instanceof ControlError ? error.action : control === "pause" ? "pause" : control === "cancel" ? "cancel" : null;
    const current = mustGetTask(id);
    if (current.status !== "running") return;
    if (action === "cancel") {
      patchTask(id, { status: "cancelled", finishedAt: nowIso(), control: null, errorMessage: null });
      addTaskEvent(id, "cancelled", "Задача отменена.");
      return;
    }
    if (action === "pause") {
      patchTask(id, { status: "paused", control: null, errorMessage: null });
      addTaskEvent(id, "paused", "Задача приостановлена. Уже сохранённые данные не удалены.");
      return;
    }
    const message = error instanceof Error ? error.message : "Ошибка выполнения.";
    patchTask(id, { status: "error", errorMessage: message, finishedAt: nowIso(), warnings, control: null });
    addTaskEvent(id, "error", message);
    logError(`task:${id}`, error);
    logActivity({
      action: "task_error",
      entityType: "task",
      entityId: id,
      message,
      directionId: current.directionId,
    });
  }
}

function makeContext(id: string, abort: AbortController, deps: JobDeps, warnings: string[]): JobContext {
  return {
    signal: abort.signal,
    checkpoint() {
      const control = readControl(id);
      if (control === "cancel" || (abort.signal.aborted && control !== "pause")) {
        throw new ControlError("cancel");
      }
      if (control === "pause") throw new ControlError("pause");
    },
    progress(percent, label, partial) {
      updateProgress(id, percent, label, partial);
    },
    warn(message) {
      warnings.push(message);
      patchTask(id, { warnings });
    },
    llm: deps.llm ?? defaultLlm,
    search: deps.search ?? defaultSearch,
    fetchSite: deps.fetchSite ?? ((url, signal) => fetchSitePage(url, signal)),
    fetchExternal: deps.fetchExternal ?? ((url, signal) => fetchExternalPage(url, signal)),
  };
}

export function requestCancel(id: string): void {
  const task = mustGetTask(id);
  if (["completed", "approved", "cancelled"].includes(task.status)) {
    throw new Error("Эту задачу уже нельзя отменить.");
  }
  if (task.status === "running") {
    patchTask(id, { control: "cancel" });
    runtime().active.get(id)?.abort();
    addTaskEvent(id, "cancel_requested", "Запрошена отмена.");
    return;
  }
  patchTask(id, { status: "cancelled", finishedAt: nowIso(), control: null });
  addTaskEvent(id, "cancelled", "Задача отменена до выполнения.");
}

export function requestPause(id: string): void {
  const task = mustGetTask(id);
  if (!["queued", "scheduled", "running"].includes(task.status)) {
    throw new Error("Приостановить можно очередь или выполняющуюся задачу.");
  }
  if (task.status === "running") {
    patchTask(id, { control: "pause" });
    runtime().active.get(id)?.abort();
    addTaskEvent(id, "pause_requested", "Запрошена пауза.");
    return;
  }
  patchTask(id, { status: "paused", control: null });
  addTaskEvent(id, "paused", "Задача снята с очереди.");
}

export function resumeTask(id: string): void {
  const task = mustGetTask(id);
  if (task.status !== "paused") throw new Error("Возобновить можно только приостановленную задачу.");
  patchTask(id, { status: "queued", control: null, errorMessage: null });
  addTaskEvent(id, "queued", "Задача снова в очереди.");
}

export function retryTask(id: string): void {
  const task = mustGetTask(id);
  if (!["error", "interrupted", "cancelled"].includes(task.status)) {
    throw new Error("Повторить можно задачу с ошибкой, прерванную или отменённую.");
  }
  patchTask(id, {
    status: "queued",
    errorMessage: null,
    finishedAt: null,
    progress: 0,
    progressLabel: "Повтор в очереди",
    control: null,
  });
  addTaskEvent(id, "retry", "Пользователь поставил задачу на повтор. Внешние вызовы выполнятся заново.");
}

import { nowIso } from "../ids";
import { addTaskEvent, patchTask } from "../tasks/store";
import type { TaskStatus } from "@/lib/labels";

export function finishTask(
  id: string,
  status: Extract<TaskStatus, "awaiting_review" | "completed">,
  result: unknown,
  warnings: string[],
): void {
  patchTask(id, {
    status,
    progress: 100,
    progressLabel: status === "awaiting_review" ? "Ожидает проверки" : "Готово",
    result,
    warnings,
    needsReview: status === "awaiting_review",
    errorMessage: null,
    finishedAt: nowIso(),
    control: null,
  });
  addTaskEvent(id, status, status === "awaiting_review" ? "Результат готов и ждёт проверки." : "Задача выполнена.");
}

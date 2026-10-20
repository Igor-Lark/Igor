import type { TaskStatus, TaskType } from "@/lib/labels";
import { isTaskType } from "@/lib/labels";
import { logActivity } from "../db/activity";
import { getDb } from "../db/client";
import { parseHttpUrl } from "../http/ssrf";
import { newId, nowIso } from "../ids";
import { addTaskEvent, getTask, insertTask, patchTask, type TaskRecord } from "../tasks/store";

const translit: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => translit[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `item-${newId().slice(0, 8)}`;
}

export function ensureWebsite(): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM websites LIMIT 1").get();
  if (existing) return;
  const now = nowIso();
  db.prepare(
    `INSERT INTO websites (id, host, name, description, positioning, content_rules, seo_rules, created_at, updated_at)
     VALUES ('site-boat-sochi', 'boat-sochi.ru', 'boat-sochi.ru', '', '', '', '', ?, ?)`,
  ).run(now, now);
}

export function createDirection(name: string, description = ""): string {
  ensureWebsite();
  const clean = name.trim();
  if (!clean) throw new Error("Укажите название направления.");
  const id = newId();
  const now = nowIso();
  let slug = slugify(clean);
  const exists = getDb().prepare("SELECT id FROM service_directions WHERE slug = ?").get(slug);
  if (exists) slug = `${slug}-${id.slice(0, 8)}`;
  getDb()
    .prepare(
      `INSERT INTO service_directions (id, website_id, slug, name, description, created_at, updated_at)
       VALUES (?, 'site-boat-sochi', ?, ?, ?, ?, ?)`,
    )
    .run(id, slug, clean, description.trim(), now, now);
  logActivity({ action: "create", entityType: "direction", entityId: id, message: `Добавлено направление «${clean}».`, directionId: id });
  return id;
}

export function updateDirection(id: string, name: string, description: string): void {
  const current = getDb().prepare("SELECT id FROM service_directions WHERE id = ?").get(id);
  if (!current) throw new Error("Направление не найдено.");
  getDb()
    .prepare("UPDATE service_directions SET name = ?, description = ?, updated_at = ? WHERE id = ?")
    .run(name.trim(), description.trim(), nowIso(), id);
}

export function createPage(input: { url: string; title: string; description?: string; directionId?: string | null }): string {
  ensureWebsite();
  const url = parseHttpUrl(input.url, true).toString();
  const title = input.title.trim();
  if (!title) throw new Error("Укажите название страницы.");
  if (input.directionId) {
    const direction = getDb().prepare("SELECT id FROM service_directions WHERE id = ?").get(input.directionId);
    if (!direction) throw new Error("Направление не найдено.");
  }
  const id = newId();
  const now = nowIso();
  try {
    getDb()
      .prepare(
        `INSERT INTO pages (id, website_id, direction_id, url, title, description, created_at, updated_at)
         VALUES (?, 'site-boat-sochi', ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.directionId || null, url, title, input.description?.trim() || "", now, now);
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new Error("Такая страница уже есть.");
    throw error;
  }
  logActivity({
    action: "create",
    entityType: "page",
    entityId: id,
    message: `Добавлена страница ${url}.`,
    directionId: input.directionId || null,
  });
  return id;
}

export type CreateTaskInput = {
  type: string;
  title: string;
  description?: string;
  directionId?: string | null;
  pageId?: string | null;
  parentTaskId?: string | null;
  input?: Record<string, unknown>;
  queue?: boolean;
  scheduledFor?: string | null;
};

export function createTask(input: CreateTaskInput): TaskRecord {
  if (!isTaskType(input.type)) throw new Error("Неизвестный тип задачи.");
  const title = input.title.trim();
  if (!title) throw new Error("Укажите название задачи.");
  const directionId = input.directionId || null;
  const pageId = input.pageId || null;
  if (directionId && !getDb().prepare("SELECT id FROM service_directions WHERE id = ?").get(directionId)) {
    throw new Error("Направление не найдено.");
  }
  if (pageId) {
    const page = getDb().prepare("SELECT direction_id FROM pages WHERE id = ?").get(pageId) as { direction_id: string | null } | undefined;
    if (!page) throw new Error("Страница не найдена.");
    if (page.direction_id && directionId && page.direction_id !== directionId) {
      throw new Error("Страница относится к другому направлению. Материалы направлений не смешиваются.");
    }
  }
  const payload = input.input || {};
  validatePayload(input.type, payload, directionId, pageId);
  const now = nowIso();
  let status: TaskStatus = "draft";
  if (input.scheduledFor) status = "scheduled";
  else if (input.queue !== false) status = "queued";
  const task: TaskRecord = {
    id: newId(),
    directionId,
    pageId,
    parentTaskId: input.parentTaskId || null,
    type: input.type,
    title,
    description: input.description?.trim() || "",
    status,
    input: payload,
    progress: 0,
    progressLabel: status === "queued" ? "В очереди" : status === "scheduled" ? "Запланирована" : "Черновик",
    partialResult: null,
    result: null,
    errorMessage: null,
    warnings: [],
    needsReview: false,
    control: null,
    scheduledFor: input.scheduledFor || null,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    updatedAt: now,
  };
  insertTask(task);
  addTaskEvent(task.id, "created", `Задача создана со статусом «${status}».`);
  logActivity({
    action: "create_task",
    entityType: "task",
    entityId: task.id,
    message: `Создана задача «${title}».`,
    directionId,
  });
  return task;
}

function validatePayload(type: TaskType, payload: Record<string, unknown>, directionId: string | null, pageId: string | null) {
  if (type === "page_fetch" && !pageId) throw new Error("Для получения страницы выберите страницу.");
  if (type === "research") {
    if (!directionId) throw new Error("Исследование нужно связать с направлением.");
    if (!String(payload.goal || "").trim()) throw new Error("Укажите цель исследования.");
  }
  if ((type === "content_proposal" || type === "seo_analysis") && !pageId) {
    throw new Error("Выберите страницу.");
  }
  if ((type === "ad_copy" || type === "image_prompt") && !directionId) {
    throw new Error("Материал нужно связать с направлением.");
  }
  if (type === "image_prompt" && !String(payload.subject || "").trim()) {
    throw new Error("Укажите основной объект изображения.");
  }
  if (type === "creative_review") {
    const asset = getDb().prepare("SELECT direction_id FROM creative_assets WHERE id = ?").get(String(payload.assetId || "")) as
      | { direction_id: string | null }
      | undefined;
    if (!asset) throw new Error("Сначала загрузите изображение.");
    if (asset.direction_id && directionId && asset.direction_id !== directionId) {
      throw new Error("Креатив относится к другому направлению.");
    }
  }
}

export function queueTask(id: string): void {
  const task = getTask(id);
  if (!task) throw new Error("Задача не найдена.");
  if (!["draft", "paused"].includes(task.status)) throw new Error("В очередь можно поставить черновик или приостановленную задачу.");
  patchTask(id, { status: "queued", progressLabel: "В очереди", control: null });
  addTaskEvent(id, "queued", "Задача поставлена в очередь.");
}

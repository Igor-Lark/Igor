export const TASK_STATUSES = [
  "draft",
  "scheduled",
  "queued",
  "running",
  "awaiting_review",
  "needs_revision",
  "approved",
  "completed",
  "paused",
  "cancelled",
  "error",
  "interrupted",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_TYPES = [
  "page_fetch",
  "research",
  "content_proposal",
  "seo_analysis",
  "ad_copy",
  "image_prompt",
  "creative_review",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  draft: "Черновик",
  scheduled: "Запланирована",
  queued: "В очереди",
  running: "Выполняется",
  awaiting_review: "Ожидает проверки",
  needs_revision: "Требует доработки",
  approved: "Согласована",
  completed: "Завершена",
  paused: "Приостановлена",
  cancelled: "Отменена",
  error: "Ошибка",
  interrupted: "Прервана",
};

export const TYPE_LABELS: Record<TaskType, string> = {
  page_fetch: "Получение страницы",
  research: "Исследование",
  content_proposal: "Предложение по контенту",
  seo_analysis: "SEO-анализ",
  ad_copy: "Рекламные объявления",
  image_prompt: "Промпт изображения",
  creative_review: "Анализ креатива",
};

export const APPROVAL_LABELS: Record<string, string> = {
  draft: "Черновик",
  in_review: "На проверке",
  needs_revision: "Требует доработки",
  approved: "Согласовано",
  rejected: "Отклонено",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  official: "Официальный источник",
  topical: "Тематический ресурс",
  company: "Публикация компании",
  forum: "Форум",
  user_observation: "Наблюдение пользователя",
  unconfirmed: "Неподтверждённое сообщение",
  site_page: "Страница boat-sochi.ru",
};

export const RELIABILITY_LABELS: Record<string, string> = {
  high: "Высокая",
  medium: "Средняя",
  low: "Низкая",
  unknown: "Не оценена",
};

export const ACTIVE_STATUSES: TaskStatus[] = ["queued", "running", "scheduled"];

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export function isTaskType(value: string): value is TaskType {
  return (TASK_TYPES as readonly string[]).includes(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export const EXPERT_SCORE_DISCLAIMER =
  "Оценки — эвристическая экспертная оценка изображения. Они не предсказывают CTR, число заявок или продажи.";

export const COMPARE_DISCLAIMER =
  "Сравнение сделано по экспертным признакам и параметрам файлов. Оно не основано на статистике рекламного кабинета.";

export const LENGTH_GUIDE =
  "Ориентир длины для проверки, а не гарантия модерации: заголовок до 56 символов, дополнительный заголовок до 30, текст до 81. Лимиты кабинета могли измениться.";

import { diffLines } from "diff";
import { STATUS_LABELS } from "@/lib/labels";
import { getDb, parseJson } from "../db/client";
import { dataDir } from "../db/paths";
import { llmConfigured, visionConfigured } from "../llm/client";
import { searchConfigured } from "../research/search";
import { listTaskComments, listTaskEvents, listTasks, type TaskFilters, type TaskRecord } from "../tasks/store";

export function dashboardData() {
  const db = getDb();
  const counts = db.prepare("SELECT status, COUNT(*) AS c FROM tasks GROUP BY status").all() as Array<{ status: string; c: number }>;
  const byStatus = Object.fromEntries(counts.map((row) => [row.status, row.c]));
  const total = counts.reduce((sum, row) => sum + row.c, 0);
  const pick = (status: string, limit = 6) =>
    listTasks({ status, sort: "updated" }).slice(0, limit);
  const directions = db
    .prepare(
      `SELECT d.id, d.name,
        SUM(CASE WHEN t.status IN ('queued', 'running', 'scheduled') THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN t.status = 'awaiting_review' THEN 1 ELSE 0 END) AS review,
        SUM(CASE WHEN t.status = 'needs_revision' THEN 1 ELSE 0 END) AS revision,
        SUM(CASE WHEN t.status = 'error' THEN 1 ELSE 0 END) AS errors
       FROM service_directions d
       LEFT JOIN tasks t ON t.direction_id = d.id
       GROUP BY d.id
       ORDER BY d.name`,
    )
    .all() as Array<{ id: string; name: string; active: number; review: number; revision: number; errors: number }>;
  return {
    total,
    running: byStatus.running || 0,
    queued: (byStatus.queued || 0) + (byStatus.scheduled || 0),
    review: byStatus.awaiting_review || 0,
    revision: byStatus.needs_revision || 0,
    errors: byStatus.error || 0,
    runningTasks: pick("running"),
    reviewTasks: pick("awaiting_review"),
    revisionTasks: pick("needs_revision"),
    errorTasks: pick("error"),
    recent: listTasks({ sort: "updated" }).filter((task) => ["completed", "approved", "awaiting_review"].includes(task.status)).slice(0, 6),
    directions,
  };
}

export function listDirections() {
  return getDb()
    .prepare(
      `SELECT d.*,
        (SELECT COUNT(*) FROM pages p WHERE p.direction_id = d.id) AS pages,
        (SELECT COUNT(*) FROM tasks t WHERE t.direction_id = d.id AND t.status IN ('queued','running','scheduled','awaiting_review','needs_revision')) AS open_tasks
       FROM service_directions d ORDER BY d.name`,
    )
    .all() as Array<Record<string, unknown>>;
}

export function directionDetail(id: string) {
  const direction = getDb().prepare("SELECT * FROM service_directions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!direction) return null;
  const pages = getDb().prepare("SELECT * FROM pages WHERE direction_id = ? ORDER BY title").all(id);
  const tasks = listTasks({ directionId: id, sort: "updated" }).slice(0, 12);
  const facts = getDb().prepare("SELECT * FROM commercial_facts WHERE direction_id = ? ORDER BY label").all(id);
  const notes = getDb().prepare("SELECT * FROM knowledge_notes WHERE direction_id = ? ORDER BY title").all(id);
  return { direction, pages, tasks, facts, notes };
}

export function listPages() {
  return getDb()
    .prepare(
      `SELECT p.*, d.name AS direction_name,
        (SELECT fetched_at FROM page_snapshots s WHERE s.page_id = p.id ORDER BY fetched_at DESC LIMIT 1) AS fetched_at
       FROM pages p LEFT JOIN service_directions d ON d.id = p.direction_id
       ORDER BY p.title`,
    )
    .all();
}

export function pageDetail(id: string) {
  const page = getDb()
    .prepare(
      `SELECT p.*, d.name AS direction_name FROM pages p
       LEFT JOIN service_directions d ON d.id = p.direction_id WHERE p.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!page) return null;
  const snapshots = (getDb().prepare("SELECT * FROM page_snapshots WHERE page_id = ? ORDER BY fetched_at DESC").all(id) as Array<Record<string, unknown>>).map(
    (row) => ({
      ...row,
      headings: parseJson(String(row.headings_json || "[]"), []),
      links: parseJson(String(row.links_json || "[]"), []),
      warnings: parseJson(String(row.warnings_json || "[]"), []),
    }),
  ) as Array<Record<string, any>>;
  const analyses = (getDb().prepare("SELECT * FROM seo_analyses WHERE page_id = ? ORDER BY conducted_at DESC").all(id) as Array<Record<string, unknown>>).map(
    (row) => ({ ...row, findings: parseJson(String(row.findings_json || "[]"), []) }),
  ) as Array<Record<string, any>>;
  const tasks = listTasks({}).filter((task) => task.pageId === id).slice(0, 20);
  let diff: Array<{ added?: boolean; removed?: boolean; value: string }> | null = null;
  if (snapshots.length >= 2) {
    diff = diffLines(String(snapshots[1].text_content || ""), String(snapshots[0].text_content || ""))
      .filter((part) => part.added || part.removed)
      .slice(0, 80);
  }
  return { page, snapshots, analyses, tasks, diff };
}

export function taskBundle(id: string) {
  const task = listTasks({}).find((item) => item.id === id) || null;
  if (!task) return null;
  return {
    task,
    events: listTaskEvents(id),
    comments: listTaskComments(id),
    direction: task.directionId
      ? (getDb().prepare("SELECT id, name FROM service_directions WHERE id = ?").get(task.directionId) as { id: string; name: string } | undefined)
      : null,
    page: task.pageId
      ? (getDb().prepare("SELECT id, title, url FROM pages WHERE id = ?").get(task.pageId) as { id: string; title: string; url: string } | undefined)
      : null,
  };
}

export function researchList() {
  const reports = getDb()
    .prepare(
      `SELECT r.*, d.name AS direction_name FROM research_reports r
       LEFT JOIN service_directions d ON d.id = r.direction_id
       ORDER BY r.conducted_at DESC`,
    )
    .all();
  const observations = getDb()
    .prepare(
      `SELECT o.*, d.name AS direction_name FROM user_observations o
       LEFT JOIN service_directions d ON d.id = o.direction_id
       ORDER BY o.created_at DESC`,
    )
    .all();
  return { reports, observations };
}

export function researchDetail(id: string) {
  const report = getDb()
    .prepare(
      `SELECT r.*, d.name AS direction_name FROM research_reports r
       LEFT JOIN service_directions d ON d.id = r.direction_id WHERE r.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!report) return null;
  const sources = getDb()
    .prepare(
      `SELECT s.* FROM sources s JOIN report_sources rs ON rs.source_id = s.id WHERE rs.report_id = ?`,
    )
    .all(id);
  return {
    report: {
      ...report,
      facts: parseJson(String(report.confirmed_facts_json || "[]"), []),
      contradictions: parseJson(String(report.contradictions_json || "[]"), []),
      uncertainties: parseJson(String(report.uncertainties_json || "[]"), []),
      recommendations: parseJson(String(report.recommendations_json || "[]"), []),
    } as Record<string, any>,
    sources,
  };
}

export function contentList() {
  return getDb()
    .prepare(
      `SELECT c.*, p.title AS page_title, d.name AS direction_name
       FROM content_versions c
       JOIN pages p ON p.id = c.page_id
       LEFT JOIN service_directions d ON d.id = c.direction_id
       ORDER BY c.created_at DESC`,
    )
    .all();
}

export function contentDetail(id: string) {
  const version = getDb()
    .prepare(
      `SELECT c.*, p.title AS page_title, p.url FROM content_versions c JOIN pages p ON p.id = c.page_id WHERE c.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!version) return null;
  const parent = version.parent_version_id
    ? (getDb().prepare("SELECT * FROM content_versions WHERE id = ?").get(version.parent_version_id) as Record<string, unknown> | undefined)
    : undefined;
  const diff = parent ? diffLines(String(parent.body || ""), String(version.body || "")).slice(0, 400) : [];
  const events = getDb()
    .prepare("SELECT * FROM approval_events WHERE target_type = 'content_version' AND target_id = ? ORDER BY at")
    .all(id);
  return { version, parent, diff, events };
}

export function adList() {
  const concepts = getDb()
    .prepare(
      `SELECT c.*, d.name AS direction_name, p.title AS page_title
       FROM advertising_concepts c
       JOIN service_directions d ON d.id = c.direction_id
       LEFT JOIN pages p ON p.id = c.page_id
       ORDER BY c.updated_at DESC`,
    )
    .all();
  return concepts;
}

export function adDetail(id: string) {
  const concept = getDb()
    .prepare(
      `SELECT c.*, d.name AS direction_name FROM advertising_concepts c
       JOIN service_directions d ON d.id = c.direction_id WHERE c.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!concept) return null;
  const copies = (getDb().prepare("SELECT * FROM ad_copy_versions WHERE concept_id = ? ORDER BY created_at DESC").all(id) as Array<Record<string, unknown>>).map(
    (copy) => ({
      ...copy,
      headlines: parseJson<string[]>(String(copy.headlines_json || "[]"), []),
      extraHeadlines: parseJson<string[]>(String(copy.extra_headlines_json || "[]"), []),
      texts: parseJson<string[]>(String(copy.texts_json || "[]"), []),
      shortVariants: parseJson<string[]>(String(copy.short_variants_json || "[]"), []),
      ctas: parseJson<string[]>(String(copy.ctas_json || "[]"), []),
      hypotheses: parseJson<string[]>(String(copy.hypotheses_json || "[]"), []),
      warnings: parseJson<string[]>(String(copy.warnings_json || "[]"), []),
    }),
  ) as Array<Record<string, any>>;
  const events = getDb()
    .prepare("SELECT * FROM approval_events WHERE target_id = ? ORDER BY at")
    .all(id);
  return { concept, copies, events };
}

export function promptList() {
  return getDb()
    .prepare(
      `SELECT i.*, d.name AS direction_name FROM image_prompts i
       JOIN service_directions d ON d.id = i.direction_id ORDER BY i.created_at DESC`,
    )
    .all();
}

export function promptDetail(id: string) {
  return getDb()
    .prepare(
      `SELECT i.*, d.name AS direction_name FROM image_prompts i
       JOIN service_directions d ON d.id = i.direction_id WHERE i.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
}

export function creativeList() {
  const assets = getDb()
    .prepare(
      `SELECT a.*, d.name AS direction_name FROM creative_assets a
       LEFT JOIN service_directions d ON d.id = a.direction_id ORDER BY a.created_at DESC`,
    )
    .all() as Array<Record<string, unknown>>;
  return assets.map((asset) => {
    const review = getDb()
      .prepare("SELECT mode, unavailable_reason, overall_note FROM creative_reviews WHERE asset_id = ? ORDER BY conducted_at DESC LIMIT 1")
      .get(asset.id) as { mode: string; unavailable_reason: string | null; overall_note: string } | undefined;
    return { ...asset, latestReview: review || null };
  });
}

export function creativeDetail(id: string) {
  const asset = getDb()
    .prepare(
      `SELECT a.*, d.name AS direction_name FROM creative_assets a
       LEFT JOIN service_directions d ON d.id = a.direction_id WHERE a.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!asset) return null;
  const reviews = (getDb().prepare("SELECT * FROM creative_reviews WHERE asset_id = ? ORDER BY conducted_at DESC").all(id) as Array<Record<string, unknown>>).map(
    (review) => ({
      ...review,
      criteria: parseJson(String(review.criteria_json || "[]"), []),
      strengths: parseJson<string[]>(String(review.strengths_json || "[]"), []),
      weaknesses: parseJson<string[]>(String(review.weaknesses_json || "[]"), []),
      critical: parseJson<string[]>(String(review.critical_json || "[]"), []),
      recommendations: parseJson<string[]>(String(review.recommendations_json || "[]"), []),
    }),
  ) as Array<Record<string, any>>;
  return { asset, reviews };
}

export function sourceList(filters: { directionId?: string; query?: string }) {
  const params: Record<string, string> = {};
  let sql = `SELECT DISTINCT s.*, GROUP_CONCAT(d.name, ', ') AS directions
    FROM sources s
    LEFT JOIN source_directions sd ON sd.source_id = s.id
    LEFT JOIN service_directions d ON d.id = sd.direction_id`;
  const where: string[] = [];
  if (filters.directionId) {
    where.push("sd.direction_id = @directionId");
    params.directionId = filters.directionId;
  }
  if (filters.query) {
    where.push("(s.title LIKE @query OR IFNULL(s.url, '') LIKE @query)");
    params.query = `%${filters.query.replace(/[%_]/g, "")}%`;
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " GROUP BY s.id ORDER BY s.accessed_at DESC";
  return getDb().prepare(sql).all(params);
}

export function historyData() {
  const activity = getDb().prepare("SELECT * FROM activity_log ORDER BY at DESC LIMIT 100").all();
  const approvals = getDb().prepare("SELECT * FROM approval_events ORDER BY at DESC LIMIT 100").all();
  return { activity, approvals };
}

export function knowledgeData() {
  const site = getDb().prepare("SELECT * FROM websites WHERE id = 'site-boat-sochi'").get();
  const notes = getDb()
    .prepare(
      `SELECT n.*, d.name AS direction_name FROM knowledge_notes n
       LEFT JOIN service_directions d ON d.id = n.direction_id ORDER BY n.scope, n.title`,
    )
    .all();
  const facts = getDb()
    .prepare(
      `SELECT f.*, d.name AS direction_name FROM commercial_facts f
       LEFT JOIN service_directions d ON d.id = f.direction_id ORDER BY d.name, f.label`,
    )
    .all();
  return { site, notes, facts };
}

export function settingsView() {
  let baseHost = "";
  try {
    baseHost = process.env.OPENAI_BASE_URL ? new URL(process.env.OPENAI_BASE_URL).host : "api.openai.com";
  } catch {
    baseHost = "некорректный OPENAI_BASE_URL";
  }
  return {
    llmConfigured: llmConfigured(),
    visionConfigured: visionConfigured(),
    searchConfigured: searchConfigured(),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    visionModel: process.env.OPENAI_VISION_MODEL || "",
    baseHost,
    maxConcurrent: Number(process.env.BCF_MAX_CONCURRENT_TASKS || 2),
    dataDir: dataDir(),
  };
}

export function options() {
  const directions = getDb().prepare("SELECT id, name FROM service_directions ORDER BY name").all() as Array<{ id: string; name: string }>;
  const pages = getDb().prepare("SELECT id, title, direction_id, url FROM pages ORDER BY title").all() as Array<{
    id: string;
    title: string;
    direction_id: string | null;
    url: string;
  }>;
  const concepts = getDb().prepare("SELECT id, name, direction_id FROM advertising_concepts ORDER BY name").all() as Array<{
    id: string;
    name: string;
    direction_id: string;
  }>;
  const assets = getDb().prepare("SELECT id, name, direction_id FROM creative_assets ORDER BY created_at DESC").all() as Array<{
    id: string;
    name: string;
    direction_id: string | null;
  }>;
  return { directions, pages, concepts, assets };
}

export function tasksFor(filters: TaskFilters): TaskRecord[] {
  return listTasks(filters);
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status;
}

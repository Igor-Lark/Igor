import fs from "fs";
import path from "path";
import { diffLines } from "diff";
import { getDb } from "../../db/client";
import { dataDir } from "../../db/paths";
import { newId, nowIso } from "../../ids";
import { finishTask } from "../finish";
import type { Handler } from "../types";

type PageRow = { id: string; url: string; direction_id: string | null; title: string };

export const handlePageFetch: Handler = async (task, ctx) => {
  if (!task.pageId) throw new Error("Не выбрана страница.");
  const page = getDb().prepare("SELECT id, url, direction_id, title FROM pages WHERE id = ?").get(task.pageId) as PageRow | undefined;
  if (!page) throw new Error("Страница не найдена.");
  ctx.checkpoint();
  ctx.progress(25, "Получаю страницу boat-sochi.ru");
  const document = await ctx.fetchSite(page.url, ctx.signal);
  ctx.checkpoint();
  const id = newId();
  const relativeHtml = path.join("snapshots", `${id}.html`);
  fs.mkdirSync(path.join(dataDir(), "snapshots"), { recursive: true });
  fs.writeFileSync(path.join(dataDir(), relativeHtml), document.html);
  const previous = getDb()
    .prepare("SELECT id, text_content FROM page_snapshots WHERE page_id = ? ORDER BY fetched_at DESC LIMIT 1")
    .get(page.id) as { id: string; text_content: string } | undefined;
  getDb()
    .prepare(
      `INSERT INTO page_snapshots (
        id, page_id, fetched_at, http_status, final_url, title_tag, meta_description, h1,
        headings_json, text_content, links_json, published_at, incomplete, warnings_json, html_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      page.id,
      nowIso(),
      document.httpStatus,
      document.finalUrl,
      document.title,
      document.metaDescription,
      document.h1,
      JSON.stringify(document.headings),
      document.httpStatus >= 400 ? "" : document.text,
      JSON.stringify(document.links),
      document.publishedAt,
      document.incomplete || document.httpStatus >= 400 ? 1 : 0,
      JSON.stringify(document.warnings),
      relativeHtml,
    );
  if (document.httpStatus >= 400) {
    throw new Error(`Страница недоступна: HTTP ${document.httpStatus}. Сохранён технический снимок, текст страницы не анализировался.`);
  }
  let diffSummary = "Предыдущего снимка нет.";
  if (previous) {
    let added = 0;
    let removed = 0;
    for (const part of diffLines(previous.text_content, document.text)) {
      const lines = part.value.split("\n").filter((line) => line.trim()).length;
      if (part.added) added += lines;
      if (part.removed) removed += lines;
    }
    diffSummary = added + removed === 0 ? "Текст совпадает с предыдущим снимком." : `Изменения текста: добавлено строк ${added}, убрано ${removed}.`;
  }
  for (const warning of document.warnings) ctx.warn(warning);
  ctx.progress(90, "Снимок сохранён");
  finishTask(task.id, document.incomplete ? "awaiting_review" : "completed", {
    kind: "page_fetch",
    snapshotId: id,
    summary: `${page.title}: HTTP ${document.httpStatus}. ${diffSummary}`,
    diffSummary,
  }, task.warnings.concat(document.warnings));
};

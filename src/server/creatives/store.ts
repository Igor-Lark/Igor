import fs from "fs";
import path from "path";
import { getDb, parseJson } from "../db/client";
import { dataDir } from "../db/paths";
import { newId, nowIso } from "../ids";
import { inspectImage } from "./image";

export function saveCreative(input: {
  bytes: Buffer;
  name: string;
  directionId?: string | null;
  pageId?: string | null;
  conceptId?: string | null;
  formatLabel?: string;
  comment?: string;
}): string {
  const info = inspectImage(input.bytes);
  const id = newId();
  const relative = path.join("uploads", `${id}.${info.extension}`);
  const absolute = path.join(dataDir(), relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, input.bytes);
  getDb()
    .prepare(
      `INSERT INTO creative_assets (
        id, direction_id, concept_id, page_id, name, format_label, mime, byte_size, width, height,
        storage_path, sha256, user_comment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.directionId || null,
      input.conceptId || null,
      input.pageId || null,
      input.name.trim() || id,
      input.formatLabel?.trim() || "",
      info.mime,
      input.bytes.length,
      info.width,
      info.height,
      relative,
      info.sha256,
      input.comment?.trim() || "",
      nowIso(),
    );
  return id;
}

export function creativeFile(id: string): { absolute: string; mime: string; name: string } | null {
  const row = getDb().prepare("SELECT storage_path, mime, name FROM creative_assets WHERE id = ?").get(id) as
    | { storage_path: string; mime: string; name: string }
    | undefined;
  if (!row) return null;
  const uploads = path.resolve(dataDir(), "uploads");
  const absolute = path.resolve(dataDir(), row.storage_path);
  if (!absolute.startsWith(`${uploads}${path.sep}`)) throw new Error("Некорректный путь файла.");
  return { absolute, mime: row.mime, name: row.name };
}

export function compareCreatives(ids: string[]) {
  const unique = [...new Set(ids)].slice(0, 4);
  if (unique.length < 2) throw new Error("Выберите хотя бы два креатива.");
  const items = unique.map((id) => {
    const asset = getDb().prepare("SELECT * FROM creative_assets WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!asset) throw new Error("Креатив не найден.");
    const reviews = getDb()
      .prepare("SELECT * FROM creative_reviews WHERE asset_id = ? ORDER BY conducted_at DESC")
      .all(id) as Array<Record<string, unknown>>;
    return {
      id,
      name: String(asset.name),
      width: asset.width,
      height: asset.height,
      byteSize: asset.byte_size,
      formatLabel: asset.format_label,
      reviews: reviews.map((review) => ({
        id: String(review.id),
        mode: String(review.mode),
        overall: String(review.overall_note || ""),
        criteria: parseJson(String(review.criteria_json || "[]"), []),
        unavailableReason: review.unavailable_reason ? String(review.unavailable_reason) : null,
        disclaimer: String(review.disclaimer || ""),
      })),
    };
  });
  return {
    disclaimer: "Сравнение основано на сохранённых разборах и параметрах файлов. Статистики рекламного кабинета нет.",
    items,
  };
}

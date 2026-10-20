import { getDb } from "./client";
import { newId, nowIso } from "../ids";

export function logActivity(entry: {
  action: string;
  entityType: string;
  entityId: string;
  message: string;
  directionId?: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO activity_log (id, at, action, entity_type, entity_id, message, direction_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(newId(), nowIso(), entry.action, entry.entityType, entry.entityId, entry.message, entry.directionId ?? null);
}

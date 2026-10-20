import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { dataDir, dbFile } from "./paths";
import { seedIfEmpty } from "./seed";

let database: Database.Database | null = null;

export function getDb(): Database.Database {
  if (database) return database;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "uploads"), { recursive: true });
  fs.mkdirSync(path.join(dir, "snapshots"), { recursive: true });
  fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
  fs.mkdirSync(path.join(dir, "backups"), { recursive: true });
  const db = new Database(dbFile());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  database = db;
  if (process.env.BCF_SEED !== "0") seedIfEmpty(db);
  return db;
}

export function closeDb(): void {
  if (database) {
    database.close();
    database = null;
  }
}

function migrate(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const dir = path.join(process.cwd(), "migrations");
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  const applied = new Set(
    (db.prepare("SELECT id FROM schema_migrations").all() as Array<{ id: string }>).map((row) => row.id),
  );
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const run = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(file, new Date().toISOString());
    });
    run();
  }
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

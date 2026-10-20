import fs from "fs";
import path from "path";
import { dataDir } from "./db/paths";

const SECRET = /(api[_-]?key|authorization|bearer\s+[a-z0-9._\-]+|sk-[a-z0-9]+)/gi;

export function redact(value: string): string {
  return value.replace(SECRET, "[redacted]");
}

export function logError(scope: string, error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const line = `${new Date().toISOString()} ${scope} ${redact(message)}\n`;
  try {
    const dir = path.join(dataDir(), "logs");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "app.log"), line);
  } catch {
    // Журнал не должен ронять задачу.
  }
}

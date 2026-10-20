import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach } from "vitest";
import { closeDb } from "@/server/db/client";

let directory = "";

export function tempRoot(): string {
  return directory;
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "bcf-"));
  process.env.BCF_DATA_DIR = directory;
  process.env.BCF_SEED = "0";
  process.env.OPENAI_API_KEY = "";
  process.env.OPENAI_VISION_MODEL = "";
  process.env.TAVILY_API_KEY = "";
  process.env.BCF_MAX_CONCURRENT_TASKS = "2";
  closeDb();
});

afterEach(() => {
  closeDb();
  fs.rmSync(directory, { recursive: true, force: true });
});

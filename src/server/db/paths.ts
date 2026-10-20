import path from "path";

export function dataDir(): string {
  return path.resolve(process.env.BCF_DATA_DIR || path.join(process.cwd(), "data"));
}

export function dbFile(): string {
  return path.join(dataDir(), "boat-content-factory.sqlite");
}

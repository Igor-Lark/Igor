import fs from "fs";
import path from "path";
import { closeDb, getDb } from "../src/server/db/client";
import { dataDir } from "../src/server/db/paths";

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.join(dataDir(), "backups", stamp);
fs.mkdirSync(destination, { recursive: true });
const db = getDb();
await db.backup(path.join(destination, "boat-content-factory.sqlite"));
closeDb();
for (const folder of ["uploads", "snapshots"]) {
  const source = path.join(dataDir(), folder);
  if (!fs.existsSync(source)) continue;
  fs.cpSync(source, path.join(destination, folder), { recursive: true });
}
console.log(destination);

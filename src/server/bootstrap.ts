import { getDb } from "./db/client";
import { startJobRunner } from "./jobs/runner";

export function bootstrap(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  getDb();
  startJobRunner();
}

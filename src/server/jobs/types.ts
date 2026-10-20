import type { TaskType } from "@/lib/labels";
import type { FetchedDocument } from "../http/pages";
import type { LlmClient } from "../llm/client";
import type { SearchClient } from "../research/search";
import type { TaskRecord } from "../tasks/store";

export class ControlError extends Error {
  constructor(public action: "cancel" | "pause") {
    super(action === "cancel" ? "Задача отменена." : "Задача приостановлена.");
    this.name = "ControlError";
  }
}

export type JobContext = {
  signal: AbortSignal;
  checkpoint: () => void;
  progress: (percent: number, label: string, partial?: unknown) => void;
  warn: (message: string) => void;
  llm: LlmClient;
  search: SearchClient;
  fetchSite: (url: string, signal?: AbortSignal) => Promise<FetchedDocument>;
  fetchExternal: (url: string, signal?: AbortSignal) => Promise<FetchedDocument>;
};

export type Handler = (task: TaskRecord, ctx: JobContext) => Promise<void>;

export type JobDeps = {
  handlers?: Partial<Record<TaskType, Handler>>;
  llm?: LlmClient;
  search?: SearchClient;
  fetchSite?: JobContext["fetchSite"];
  fetchExternal?: JobContext["fetchExternal"];
};

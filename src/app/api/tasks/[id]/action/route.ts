import { NextResponse } from "next/server";
import { requestCancel, requestPause, resumeTask, retryTask } from "@/server/jobs/runner";
import { queueTask } from "@/server/services/tasks";
import { addTaskComment } from "@/server/tasks/store";
import { fail, readJson } from "../../../helpers";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    const action = String(body.action || "");
    if (action === "cancel") requestCancel(id);
    else if (action === "pause") requestPause(id);
    else if (action === "resume") resumeTask(id);
    else if (action === "retry") retryTask(id);
    else if (action === "queue") queueTask(id);
    else if (action === "comment") {
      const text = String(body.body || "").trim();
      if (!text) throw new Error("Пустой комментарий.");
      addTaskComment(id, text);
    } else throw new Error("Неизвестное действие.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

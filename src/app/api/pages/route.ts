import { NextResponse } from "next/server";
import { fail, readJson } from "../helpers";
import { createPage, createTask } from "@/server/services/tasks";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const id = createPage({
      url: String(body.url || ""),
      title: String(body.title || ""),
      description: String(body.description || ""),
      directionId: body.directionId ? String(body.directionId) : null,
    });
    let taskId: string | null = null;
    if (body.fetchNow !== false) {
      const task = createTask({
        type: "page_fetch",
        title: `Снимок: ${String(body.title || body.url)}`,
        pageId: id,
        directionId: body.directionId ? String(body.directionId) : null,
        queue: true,
      });
      taskId = task.id;
    }
    return NextResponse.json({ id, taskId }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

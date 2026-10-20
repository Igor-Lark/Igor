import { NextResponse } from "next/server";
import { fail, readJson } from "../helpers";
import { tasksFor } from "@/server/read/catalog";
import { createTask } from "@/server/services/tasks";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json(
    tasksFor({
      directionId: url.searchParams.get("direction") || undefined,
      type: url.searchParams.get("type") || undefined,
      status: url.searchParams.get("status") || undefined,
      query: url.searchParams.get("q") || undefined,
      sort: url.searchParams.get("sort") === "updated" ? "updated" : "created",
    }),
  );
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const task = createTask({
      type: String(body.type || ""),
      title: String(body.title || ""),
      description: String(body.description || ""),
      directionId: body.directionId ? String(body.directionId) : null,
      pageId: body.pageId ? String(body.pageId) : null,
      parentTaskId: body.parentTaskId ? String(body.parentTaskId) : null,
      input: body.input && typeof body.input === "object" ? (body.input as Record<string, unknown>) : {},
      queue: body.queue !== false,
      scheduledFor: body.scheduledFor ? String(body.scheduledFor) : null,
    });
    return NextResponse.json({ id: task.id }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

import { NextResponse } from "next/server";
import { saveCreative } from "@/server/creatives/store";
import { createTask } from "@/server/services/tasks";
import { fail } from "../helpers";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Файл не передан.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const directionId = String(form.get("directionId") || "") || null;
    const id = saveCreative({
      bytes,
      name: String(form.get("name") || file.name),
      directionId,
      pageId: String(form.get("pageId") || "") || null,
      conceptId: String(form.get("conceptId") || "") || null,
      formatLabel: String(form.get("formatLabel") || ""),
      comment: String(form.get("comment") || ""),
    });
    let taskId: string | null = null;
    if (form.get("analyze") === "on" || form.get("analyze") === "true") {
      const task = createTask({
        type: "creative_review",
        title: `Разбор: ${String(form.get("name") || file.name)}`,
        directionId,
        pageId: String(form.get("pageId") || "") || null,
        input: { assetId: id },
        queue: true,
      });
      taskId = task.id;
    }
    return NextResponse.json({ id, taskId }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

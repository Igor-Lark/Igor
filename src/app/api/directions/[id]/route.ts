import { NextResponse } from "next/server";
import { fail, readJson } from "../../helpers";
import { updateDirection } from "@/server/services/tasks";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    updateDirection(id, String(body.name || ""), String(body.description || ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

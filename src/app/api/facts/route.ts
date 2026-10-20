import { NextResponse } from "next/server";
import { addFact, confirmFact } from "@/server/services/approval";
import { fail, readJson } from "../helpers";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (body.confirmId) {
      confirmFact(String(body.confirmId));
      return NextResponse.json({ ok: true });
    }
    const id = addFact({
      directionId: body.directionId ? String(body.directionId) : null,
      pageId: body.pageId ? String(body.pageId) : null,
      kind: String(body.kind || "other"),
      label: String(body.label || ""),
      value: String(body.value || ""),
      sourceNote: String(body.sourceNote || ""),
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

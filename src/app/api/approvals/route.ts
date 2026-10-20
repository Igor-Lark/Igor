import { NextResponse } from "next/server";
import { decideMaterial } from "@/server/services/approval";
import { fail, readJson } from "../helpers";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    decideMaterial({
      targetType: String(body.targetType || ""),
      targetId: String(body.targetId || ""),
      decision: String(body.decision || ""),
      comment: String(body.comment || ""),
    });
    return NextResponse.json({ ok: true, externalAction: false });
  } catch (error) {
    return fail(error);
  }
}

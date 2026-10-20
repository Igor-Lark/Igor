import { NextResponse } from "next/server";
import { saveUserContentVersion } from "@/server/services/approval";
import { fail, readJson } from "../helpers";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const id = saveUserContentVersion({
      parentVersionId: String(body.parentVersionId || ""),
      body: String(body.body || ""),
      reason: String(body.reason || ""),
      title: String(body.title || ""),
      titleTag: String(body.titleTag || ""),
      metaDescription: String(body.metaDescription || ""),
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

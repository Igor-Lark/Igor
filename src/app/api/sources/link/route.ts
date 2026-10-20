import { NextResponse } from "next/server";
import { linkSourceToDirection } from "@/server/services/approval";
import { fail, readJson } from "../../helpers";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    linkSourceToDirection(String(body.sourceId || ""), String(body.directionId || ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

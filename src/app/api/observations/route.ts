import { NextResponse } from "next/server";
import { addObservation } from "@/server/services/approval";
import { fail, readJson } from "../helpers";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const id = addObservation({
      directionId: body.directionId ? String(body.directionId) : null,
      pageId: body.pageId ? String(body.pageId) : null,
      observedOn: String(body.observedOn || ""),
      periodLabel: String(body.periodLabel || ""),
      authorLabel: String(body.authorLabel || ""),
      body: String(body.body || ""),
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

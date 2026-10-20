import { NextResponse } from "next/server";
import { compareCreatives } from "@/server/creatives/store";
import { fail } from "../../helpers";

export async function GET(request: Request) {
  try {
    const ids = (new URL(request.url).searchParams.get("ids") || "").split(",").filter(Boolean);
    return NextResponse.json(compareCreatives(ids));
  } catch (error) {
    return fail(error);
  }
}

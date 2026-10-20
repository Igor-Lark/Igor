import { NextResponse } from "next/server";
import { fail, readJson } from "../helpers";
import { createDirection } from "@/server/services/tasks";
import { listDirections } from "@/server/read/catalog";

export async function GET() {
  return NextResponse.json(listDirections());
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const id = createDirection(String(body.name || ""), String(body.description || ""));
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

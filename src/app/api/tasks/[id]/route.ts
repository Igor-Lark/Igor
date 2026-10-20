import { NextResponse } from "next/server";
import { taskBundle } from "@/server/read/catalog";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const bundle = taskBundle(id);
  if (!bundle) return NextResponse.json({ error: "Задача не найдена." }, { status: 404 });
  return NextResponse.json(bundle);
}

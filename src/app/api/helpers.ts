import { NextResponse } from "next/server";

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object") throw new Error("Нужен JSON-объект.");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.message === "Нужен JSON-объект.") throw error;
    throw new Error("Не удалось прочитать запрос.");
  }
}

export function fail(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Ошибка";
  return NextResponse.json({ error: message }, { status });
}

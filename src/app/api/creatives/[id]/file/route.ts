import fs from "fs";
import { creativeFile } from "@/server/creatives/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = creativeFile(id);
  if (!file || !fs.existsSync(file.absolute)) {
    return new Response("Файл не найден.", { status: 404 });
  }
  const bytes = fs.readFileSync(file.absolute);
  return new Response(bytes, {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

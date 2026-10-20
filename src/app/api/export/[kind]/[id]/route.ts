import { exportMaterial } from "@/server/export/material";
import { fail } from "../../../helpers";

export async function GET(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const { kind, id } = await context.params;
    const format = new URL(request.url).searchParams.get("format") || "md";
    const file = exportMaterial(kind, id, format);
    return new Response(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
    });
  } catch (error) {
    return fail(error, 404);
  }
}

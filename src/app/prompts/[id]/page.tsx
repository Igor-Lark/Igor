import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { DecisionForm } from "@/components/Forms";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/labels";
import { promptDetail } from "@/server/read/catalog";

export default async function PromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prompt = promptDetail(id) as {
    id: string; name: string; direction_name: string; purpose: string; target_format: string; subject: string;
    prompt_text: string; origin: string; approval_status: string; created_at: string; reference_note: string;
  } | undefined;
  if (!prompt) notFound();
  return (
    <>
      <h1>{prompt.name}</h1>
      <p className="muted">{prompt.direction_name} · {formatDate(prompt.created_at)} · {prompt.origin === "llm" ? "уточнён моделью" : "собран из полей"} · <StatusBadge status={prompt.approval_status} /></p>
      <CopyButton href={`/api/export/prompt/${prompt.id}?format=txt`} />
      <section className="panel"><pre className="text-block">{prompt.prompt_text}</pre></section>
      <DecisionForm targetType="image_prompt" targetId={prompt.id} />
    </>
  );
}

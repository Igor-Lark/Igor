import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { DecisionForm, RevisionForm } from "@/components/Forms";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/labels";
import { contentDetail } from "@/server/read/catalog";

export default async function ContentVersionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = contentDetail(id);
  if (!data) notFound();
  const version = data.version as { id: string; title: string; body: string; title_tag: string; meta_description: string; reason: string; change_explanation: string; approval_status: string; created_at: string; page_title: string; url: string; origin: string };
  const parent = data.parent as { body?: string; title_tag?: string; meta_description?: string } | undefined;
  return (
    <>
      <h1>{version.title || version.page_title}</h1>
      <p className="muted">{version.page_title} · {formatDate(version.created_at)} · <StatusBadge status={version.approval_status} /></p>
      <CopyButton href={`/api/export/content/${id}?format=md`} />
      <section className="panel"><h2>Зачем предложено</h2><p>{version.reason || "Не указано."}</p><p className="text-block">{version.change_explanation}</p></section>
      <div className="split">
        <section className="panel"><h2>Было</h2><pre className="text-block">{parent?.body || "Исходная версия не связана."}</pre></section>
        <section className="panel"><h2>Стало</h2><pre className="text-block">{version.body}</pre></section>
      </div>
      <section className="panel diff">
        <h2>Различия</h2>
        {data.diff.length === 0 ? <p>Текст совпадает или сравнивать не с чем.</p> : data.diff.map((part, index) => (
          part.added ? <ins key={index}>{part.value}</ins> : part.removed ? <del key={index}>{part.value}</del> : <span key={index}>{part.value}</span>
        ))}
      </section>
      <section className="panel">
        <h2>Решение</h2>
        <DecisionForm targetType="content_version" targetId={version.id} />
      </section>
      <section className="panel">
        <h2>Новая версия на основе этой</h2>
        <RevisionForm parentVersionId={version.id} body={version.body} />
      </section>
    </>
  );
}

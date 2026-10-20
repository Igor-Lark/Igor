import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { SOURCE_TYPE_LABELS, RELIABILITY_LABELS, formatDate } from "@/lib/labels";
import { researchDetail } from "@/server/read/catalog";

export default async function ResearchReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = researchDetail(id);
  if (!data) notFound();
  const report = data.report as unknown as {
    goal: string;
    conducted_at: string;
    direction_name: string | null;
    summary: string;
    synthesis_mode: string;
    application_notes: string;
    changes_vs_previous: string;
    facts: Array<{ statement: string; sourceUrls?: string[] }>;
    contradictions: Array<{ statement: string }>;
    uncertainties: string[];
    recommendations: Array<{ statement: string; isHypothesis?: boolean }>;
  };
  const sources = data.sources as Array<{ id: string; title: string; url: string | null; published_at: string | null; accessed_at: string; source_type: string; reliability: string; reliability_note: string; unavailable: number }>;
  return (
    <>
      <h1>{report.goal}</h1>
      <p className="muted">{report.direction_name} · {formatDate(report.conducted_at)} · {report.synthesis_mode === "llm" ? "синтез по полученным источникам" : "фрагменты без выводов модели"}</p>
      <CopyButton href={`/api/export/research/${id}?format=md`} />
      <section className="panel"><h2>Краткий вывод</h2><p className="text-block">{report.summary}</p></section>
      <section className="panel">
        <h2>Подтверждённые факты</h2>
        <ul>{report.facts.length ? report.facts.map((fact) => <li key={fact.statement}>{fact.statement} {fact.sourceUrls?.map((url) => <span key={url}> <a href={url}>{url}</a></span>)}</li>) : <li>Нет пунктов, привязанных к полученным источникам.</li>}</ul>
      </section>
      <section className="panel"><h2>Противоречия</h2><ul>{report.contradictions.length ? report.contradictions.map((item) => <li key={item.statement}>{item.statement}</li>) : <li>Не зафиксированы.</li>}</ul></section>
      <section className="panel"><h2>Неопределённости</h2><ul>{report.uncertainties.length ? report.uncertainties.map((item) => <li key={item}>{item}</li>) : <li>Не зафиксированы.</li>}</ul></section>
      <section className="panel"><h2>Рекомендации</h2><ul>{report.recommendations.length ? report.recommendations.map((item) => <li key={item.statement}>{item.isHypothesis === false ? "" : "Гипотеза. "}{item.statement}</li>) : <li>Нет.</li>}</ul></section>
      <section className="panel"><h2>Как применить</h2><p className="text-block">{report.application_notes || "Не указано."}</p></section>
      <section className="panel"><h2>Сравнение с прошлым отчётом</h2><pre className="text-block">{report.changes_vs_previous}</pre></section>
      <section className="panel">
        <h2>Источники</h2>
        {sources.map((source) => (
          <article key={source.id}>
            <p><b>{source.title}</b> {source.unavailable ? "· недоступен" : ""}</p>
            <p>{source.url ? <a href={source.url}>{source.url}</a> : "URL нет"}</p>
            <p className="muted">{SOURCE_TYPE_LABELS[source.source_type] || source.source_type} · надёжность: {RELIABILITY_LABELS[source.reliability] || source.reliability} · публикация: {source.published_at || "дата неизвестна"} · обращение: {formatDate(source.accessed_at)}</p>
            <p>{source.reliability_note}</p>
          </article>
        ))}
      </section>
      <p><Link href="/research">Все исследования</Link></p>
    </>
  );
}

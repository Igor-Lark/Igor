import Link from "next/link";
import { ObservationForm } from "@/components/Forms";
import { formatDate } from "@/lib/labels";
import { options, researchList } from "@/server/read/catalog";

export default function ResearchPage() {
  const { reports, observations } = researchList() as {
    reports: Array<{ id: string; goal: string; conducted_at: string; direction_name: string | null; synthesis_mode: string }>;
    observations: Array<{ id: string; observed_on: string; author_label: string; body: string; direction_name: string | null; period_label: string }>;
  };
  const { directions } = options();
  return (
    <>
      <h1>Исследования</h1>
      <p className="lede">Отчёты строятся только по полученным источникам. Наблюдения капитанов и сотрудников хранятся отдельно и не выдаются за независимые факты.</p>
      <p><Link className="button" href="/tasks/new?type=research">Новое исследование</Link></p>
      <section className="panel">
        <h2>Отчёты</h2>
        {reports.length === 0 ? <p className="muted">Отчётов пока нет.</p> : (
          <ul>
            {reports.map((report) => (
              <li key={report.id}>
                <Link href={`/research/${report.id}`}>{report.goal}</Link>
                <div className="muted">{report.direction_name || "Без направления"} · {formatDate(report.conducted_at)} · {report.synthesis_mode === "llm" ? "синтез по источникам" : "только фрагменты"}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <h2>Наблюдения пользователя</h2>
        {observations.length === 0 ? <p className="muted">Наблюдений пока нет.</p> : observations.map((item) => (
          <article key={item.id}>
            <p><b>Наблюдение пользователя.</b> {item.observed_on} {item.period_label ? `· ${item.period_label}` : ""} · {item.author_label || "автор не указан"} · {item.direction_name || "без направления"}</p>
            <p>{item.body}</p>
          </article>
        ))}
        <ObservationForm directions={directions} />
      </section>
    </>
  );
}

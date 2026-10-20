import Link from "next/link";
import { notFound } from "next/navigation";
import { FetchPageButton } from "@/components/Forms";
import { StatusBadge } from "@/components/StatusBadge";
import { TYPE_LABELS, formatDate } from "@/lib/labels";
import { pageDetail } from "@/server/read/catalog";

export default async function PageDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = pageDetail(id);
  if (!data) notFound();
  const page = data.page as { id: string; title: string; url: string; description: string; direction_id: string | null; direction_name: string | null };
  const latest = data.snapshots[0] as { title_tag?: string; meta_description?: string; h1?: string; text_content?: string; incomplete?: number; warnings?: string[]; links?: Array<{ href: string; text: string }>; headings?: Array<{ level: number; text: string }>; fetched_at?: string; http_status?: number } | undefined;
  return (
    <>
      <h1>{page.title}</h1>
      <p className="lede"><a href={page.url}>{page.url}</a> · {page.direction_name || "Общая страница"}</p>
      <p>{page.description}</p>
      <FetchPageButton pageId={page.id} directionId={page.direction_id} title={page.title} />
      <p><Link href={`/tasks/new?type=seo_analysis&page=${page.id}&direction=${page.direction_id || ""}`}>SEO-анализ</Link> · <Link href={`/tasks/new?type=content_proposal&page=${page.id}&direction=${page.direction_id || ""}`}>Предложение по тексту</Link></p>
      <section className="panel">
        <h2>Последний снимок</h2>
        {!latest ? <p className="muted">Страница ещё не загружалась. Пока нет текста, анализ по ней не выполняется.</p> : (
          <>
            <p className="muted">{formatDate(latest.fetched_at)} · HTTP {latest.http_status} {latest.incomplete ? "· текст неполный" : ""}</p>
            <p><b>Title:</b> {latest.title_tag || "нет"}</p>
            <p><b>Description:</b> {latest.meta_description || "нет"}</p>
            <p><b>H1:</b> {latest.h1 || "нет"}</p>
            {(latest.warnings || []).map((warning) => <p key={warning} className="notice">{warning}</p>)}
            <h3>Заголовки</h3>
            <ul>{(latest.headings || []).map((heading, index) => <li key={`${heading.text}-${index}`}>H{heading.level}. {heading.text}</li>)}</ul>
            <h3>Внутренние ссылки</h3>
            <ul>{(latest.links || []).slice(0, 30).map((link) => <li key={link.href}><a href={link.href}>{link.text || link.href}</a></li>)}</ul>
            <h3>Текст</h3>
            <pre className="text-block">{latest.text_content}</pre>
          </>
        )}
      </section>
      {data.diff ? (
        <section className="panel diff">
          <h2>Отличия от предыдущего снимка</h2>
          {data.diff.length === 0 ? <p>Текст не изменился.</p> : data.diff.map((part, index) => (
            part.added ? <ins key={index}>{part.value}</ins> : <del key={index}>{part.value}</del>
          ))}
        </section>
      ) : null}
      <section className="panel">
        <h2>История снимков</h2>
        <ul>
          {data.snapshots.map((snapshot) => (
            <li key={String(snapshot.id)}>{formatDate(String(snapshot.fetched_at))} · HTTP {String(snapshot.http_status)} · {snapshot.incomplete ? "неполный" : "получен"}</li>
          ))}
        </ul>
      </section>
      <section className="panel" id="seo">
        <h2>SEO-разборы</h2>
        {data.analyses.length === 0 ? <p className="muted">Разборов пока нет.</p> : data.analyses.map((analysis) => (
          <article key={String(analysis.id)}>
            <p>{formatDate(String(analysis.conducted_at))} · предварительный</p>
            <ul>
              {(analysis.findings as Array<{ title: string; detail: string; heuristic: boolean }>).map((finding) => (
                <li key={finding.title}><b>{finding.title}.</b> {finding.detail} {finding.heuristic ? "(эвристика)" : ""}</li>
              ))}
            </ul>
            {analysis.llm_notes ? <p className="text-block">{String(analysis.llm_notes)}</p> : null}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Связанные задачи</h2>
        <ul>
          {data.tasks.map((task) => <li key={task.id}><Link href={`/tasks/${task.id}`}>{task.title}</Link> {TYPE_LABELS[task.type]} <StatusBadge status={task.status} /></li>)}
        </ul>
      </section>
    </>
  );
}

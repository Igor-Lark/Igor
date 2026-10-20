import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CommentForm, TaskActions } from "@/components/Forms";
import { StatusBadge } from "@/components/StatusBadge";
import { TYPE_LABELS, formatDate } from "@/lib/labels";
import { taskBundle } from "@/server/read/catalog";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = taskBundle(id);
  if (!bundle) notFound();
  const { task, events, comments, direction, page } = bundle;
  const result = task.result && typeof task.result === "object" ? task.result as Record<string, unknown> : null;
  const active = ["queued", "running", "scheduled"].includes(task.status);
  return (
    <>
      <AutoRefresh active={active} />
      <h1>{task.title}</h1>
      <p className="row">
        <StatusBadge status={task.status} />
        <span>{TYPE_LABELS[task.type]}</span>
        {direction ? <Link href={`/directions/${direction.id}`}>{direction.name}</Link> : null}
        {page ? <Link href={`/pages/${page.id}`}>{page.title}</Link> : null}
      </p>
      <div className="progress" aria-label="Прогресс"><span style={{ width: `${task.progress}%` }} /></div>
      <p className="muted">{task.progressLabel || "Без промежуточного шага"} · создана {formatDate(task.createdAt)} · старт {formatDate(task.startedAt)} · финиш {formatDate(task.finishedAt)}</p>
      {task.description ? <p>{task.description}</p> : null}
      {task.errorMessage ? <p className="error">{task.errorMessage}</p> : null}
      {task.warnings.length ? (
        <div className="notice">{task.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
      ) : null}
      <TaskActions id={task.id} status={task.status} />
      <p><Link href={`/tasks/new?parent=${task.id}&direction=${task.directionId || ""}&page=${task.pageId || ""}`}>Новая задача на основе этой</Link></p>
      <section className="panel">
        <h2>Результат</h2>
        <ResultLinks result={result} />
        {task.partialResult ? <pre className="text-block">{JSON.stringify(task.partialResult, null, 2)}</pre> : null}
      </section>
      <section className="panel">
        <h2>История</h2>
        <ul>
          {events.map((event) => <li key={event.id}>{formatDate(event.at)} — {event.message}</li>)}
        </ul>
      </section>
      <section className="panel">
        <h2>Комментарии</h2>
        <ul>{comments.map((comment) => <li key={comment.id}>{formatDate(comment.at)} — {comment.body}</li>)}</ul>
        <CommentForm id={task.id} />
      </section>
    </>
  );
}

function ResultLinks({ result }: { result: Record<string, unknown> | null }) {
  if (!result) return <p className="muted">Итога пока нет.</p>;
  const summary = String(result.summary || "");
  return (
    <>
      {summary ? <p>{summary}</p> : null}
      {result.reportId ? <p><Link href={`/research/${result.reportId}`}>Открыть отчёт</Link></p> : null}
      {result.proposalId ? <p><Link href={`/content/${result.proposalId}`}>Открыть предложение</Link></p> : null}
      {result.originalId ? <p><Link href={`/content/${result.originalId}`}>Исходная версия</Link></p> : null}
      {result.snapshotId ? <p>Снимок сохранён.</p> : null}
      {result.analysisId ? <p>SEO-разбор сохранён на странице.</p> : null}
      {result.conceptId ? <p><Link href={`/ads/${result.conceptId}`}>Открыть концепцию</Link></p> : null}
      {result.promptId ? <p><Link href={`/prompts/${result.promptId}`}>Открыть промпт</Link></p> : null}
      {result.reviewId ? <p>Разбор креатива сохранён в карточке файла.</p> : null}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { DirectionEdit, FactConfirm, FactForm } from "@/components/Forms";
import { StatusBadge } from "@/components/StatusBadge";
import { TYPE_LABELS, formatDate } from "@/lib/labels";
import { directionDetail } from "@/server/read/catalog";

export default async function DirectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = directionDetail(id);
  if (!data) notFound();
  const direction = data.direction as { id: string; name: string; description: string };
  const pages = data.pages as Array<{ id: string; title: string; url: string }>;
  const facts = data.facts as Array<{ id: string; label: string; value: string; confirmed: number; source_note: string }>;
  const notes = data.notes as Array<{ id: string; title: string; body: string }>;
  return (
    <>
      <h1>{direction.name}</h1>
      <p className="lede">{direction.description}</p>
      <p className="row">
        <Link className="button" href={`/tasks/new?direction=${direction.id}`}>Задача в этом направлении</Link>
        <Link href={`/tasks?direction=${direction.id}`}>Все задачи</Link>
        <Link href={`/ads?direction=${direction.id}`}>Реклама</Link>
      </p>
      <section className="panel">
        <h2>Описание</h2>
        <DirectionEdit id={direction.id} name={direction.name} description={direction.description} />
      </section>
      <section className="panel">
        <h2>Страницы</h2>
        <ul>
          {pages.map((page) => <li key={page.id}><Link href={`/pages/${page.id}`}>{page.title}</Link> <span className="muted">{page.url}</span></li>)}
          {pages.length === 0 ? <li className="muted">Страниц пока нет.</li> : null}
        </ul>
      </section>
      <section className="panel">
        <h2>Задачи</h2>
        <ul>
          {data.tasks.map((task) => (
            <li key={task.id}><Link href={`/tasks/${task.id}`}>{task.title}</Link> {TYPE_LABELS[task.type]} <StatusBadge status={task.status} /> <span className="muted">{formatDate(task.updatedAt)}</span></li>
          ))}
          {data.tasks.length === 0 ? <li className="muted">Задач пока нет.</li> : null}
        </ul>
      </section>
      <section className="panel">
        <h2>Коммерческие условия</h2>
        <p className="muted">Неподтверждённые значения нельзя считать утверждёнными. Подтверждение не меняет сам текст условия.</p>
        <table>
          <thead><tr><th>Условие</th><th>Значение</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {facts.map((fact) => (
              <tr key={fact.id}>
                <td>{fact.label}<div className="muted">{fact.source_note}</div></td>
                <td>{fact.value}</td>
                <td>{fact.confirmed ? "Подтверждено" : "Не подтверждено"}</td>
                <td>{fact.confirmed ? null : <FactConfirm id={fact.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>Добавить условие</h2>
        <FactForm directionId={direction.id} />
      </section>
      <section className="panel">
        <h2>Заметки направления</h2>
        {notes.map((note) => <article key={note.id}><h3>{note.title}</h3><p className="text-block">{note.body}</p></article>)}
      </section>
    </>
  );
}

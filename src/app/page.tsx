import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/labels";
import { dashboardData } from "@/server/read/catalog";
import type { TaskRecord } from "@/server/tasks/store";

function TaskList({ tasks, empty }: { tasks: TaskRecord[]; empty: string }) {
  if (!tasks.length) return <p className="muted">{empty}</p>;
  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>
          <Link href={`/tasks/${task.id}`}>{task.title}</Link> <StatusBadge status={task.status} />
          <div className="muted">{formatDate(task.updatedAt)}</div>
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  const data = dashboardData();
  return (
    <>
      <h1>Обзор</h1>
      <p className="lede">Материалы для boat-sochi.ru. Приложение готовит и хранит их, но не публикует на сайт и не меняет рекламный кабинет.</p>
      <div className="grid">
        <div className="card"><span className="muted">Всего задач</span><b>{data.total}</b></div>
        <div className="card"><span className="muted">Выполняются</span><b>{data.running}</b></div>
        <div className="card"><span className="muted">В очереди</span><b>{data.queued}</b></div>
        <div className="card"><span className="muted">Ждут проверки</span><b>{data.review}</b></div>
        <div className="card"><span className="muted">Нужна доработка</span><b>{data.revision}</b></div>
        <div className="card"><span className="muted">Ошибки</span><b>{data.errors}</b></div>
      </div>
      <p><Link className="button" href="/tasks/new">Новая задача</Link></p>
      <div className="split">
        <section className="panel">
          <h2>Сейчас выполняются</h2>
          <TaskList tasks={data.runningTasks} empty="Сейчас ничего не выполняется." />
        </section>
        <section className="panel">
          <h2>Ждут проверки</h2>
          <TaskList tasks={data.reviewTasks} empty="Нет задач на проверке." />
        </section>
      </div>
      <div className="split">
        <section className="panel">
          <h2>Нужна доработка</h2>
          <TaskList tasks={data.revisionTasks} empty="Нет задач на доработке." />
        </section>
        <section className="panel">
          <h2>Последние ошибки</h2>
          <TaskList tasks={data.errorTasks} empty="Ошибок нет." />
        </section>
      </div>
      <section className="panel">
        <h2>Направления</h2>
        <table>
          <thead><tr><th>Направление</th><th>В работе</th><th>На проверке</th><th>Доработка</th><th>Ошибки</th></tr></thead>
          <tbody>
            {data.directions.map((item) => (
              <tr key={item.id}>
                <td><Link href={`/directions/${item.id}`}>{item.name}</Link></td>
                <td>{item.active}</td>
                <td>{item.review}</td>
                <td>{item.revision}</td>
                <td>{item.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

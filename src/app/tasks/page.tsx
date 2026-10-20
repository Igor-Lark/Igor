import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { TYPE_LABELS, TASK_STATUSES, STATUS_LABELS, formatDate } from "@/lib/labels";
import { options, tasksFor } from "@/server/read/catalog";

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const tasks = tasksFor({
    directionId: params.direction,
    type: params.type,
    status: params.status,
    query: params.q,
    sort: params.sort === "updated" ? "updated" : "created",
  });
  const { directions } = options();
  return (
    <>
      <h1>Задачи</h1>
      <p className="lede">Общий список по всем направлениям. Задачи выполняются независимо друг от друга.</p>
      <p><Link className="button" href="/tasks/new">Новая задача</Link></p>
      <form className="filters" method="get">
        <input name="q" defaultValue={params.q || ""} placeholder="Поиск по названию" />
        <select name="direction" defaultValue={params.direction || ""}>
          <option value="">Все направления</option>
          {directions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select name="type" defaultValue={params.type || ""}>
          <option value="">Все типы</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select name="status" defaultValue={params.status || ""}>
          <option value="">Все статусы</option>
          {TASK_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
        </select>
        <select name="sort" defaultValue={params.sort || "created"}>
          <option value="created">Сначала новые</option>
          <option value="updated">По обновлению</option>
        </select>
        <button>Показать</button>
      </form>
      {tasks.length === 0 ? <p className="muted">Задач с такими условиями нет.</p> : (
        <table>
          <thead><tr><th>Задача</th><th>Тип</th><th>Статус</th><th>Прогресс</th><th>Обновлена</th></tr></thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td><Link href={`/tasks/${task.id}`}>{task.title}</Link></td>
                <td>{TYPE_LABELS[task.type]}</td>
                <td><StatusBadge status={task.status} /></td>
                <td>{task.progress}% {task.progressLabel}</td>
                <td>{formatDate(task.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

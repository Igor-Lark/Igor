import { APPROVAL_LABELS, formatDate } from "@/lib/labels";
import { historyData } from "@/server/read/catalog";

export default function HistoryPage() {
  const { activity, approvals } = historyData() as {
    activity: Array<{ id: string; at: string; message: string }>;
    approvals: Array<{ id: string; at: string; target_type: string; decision: string; comment: string }>;
  };
  return (
    <>
      <h1>История и согласования</h1>
      <p className="lede">События приложения. Согласование относится к конкретной версии и не запускает публикацию.</p>
      <section className="panel">
        <h2>Решения</h2>
        {approvals.length === 0 ? <p className="muted">Решений пока нет.</p> : (
          <ul>{approvals.map((event) => <li key={event.id}>{formatDate(event.at)} · {event.target_type} · {APPROVAL_LABELS[event.decision] || event.decision} {event.comment ? `· ${event.comment}` : ""}</li>)}</ul>
        )}
      </section>
      <section className="panel">
        <h2>Действия</h2>
        {activity.length === 0 ? <p className="muted">Журнал пуст.</p> : <ul>{activity.map((event) => <li key={event.id}>{formatDate(event.at)} · {event.message}</li>)}</ul>}
      </section>
    </>
  );
}

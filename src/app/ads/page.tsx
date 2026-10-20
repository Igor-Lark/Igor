import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/labels";
import { adList } from "@/server/read/catalog";

export default async function AdsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const concepts = (adList() as Array<{ id: string; name: string; direction_id: string; direction_name: string; goal: string; approval_status: string; updated_at: string }>).filter((item) => !params.direction || item.direction_id === params.direction);
  return (
    <>
      <h1>Реклама</h1>
      <p className="lede">Концепции и тексты для Директа и РСЯ готовятся здесь. В кабинет они сами не уходят.</p>
      <p><Link className="button" href="/tasks/new?type=ad_copy">Новая рекламная задача</Link></p>
      {concepts.length === 0 ? <p className="muted">Концепций пока нет.</p> : (
        <table>
          <thead><tr><th>Концепция</th><th>Направление</th><th>Цель</th><th>Статус</th><th>Обновлена</th></tr></thead>
          <tbody>
            {concepts.map((concept) => (
              <tr key={concept.id}>
                <td><Link href={`/ads/${concept.id}`}>{concept.name}</Link></td>
                <td>{concept.direction_name}</td>
                <td>{concept.goal || "—"}</td>
                <td><StatusBadge status={concept.approval_status} /></td>
                <td>{formatDate(concept.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

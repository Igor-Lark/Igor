import Link from "next/link";
import { notFound } from "next/navigation";
import { creativeDetail, creativeList } from "@/server/read/catalog";
import { formatDate } from "@/lib/labels";

export default async function CreativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = creativeDetail(id);
  if (!data) notFound();
  const asset = data.asset as { id: string; name: string; direction_name: string | null; width: number; height: number; mime: string; byte_size: number; format_label: string; user_comment: string; created_at: string; sha256: string };
  const others = (creativeList() as unknown as Array<{ id: string; name: string }>).filter((item) => item.id !== id).slice(0, 8);
  return (
    <>
      <h1>{asset.name}</h1>
      <p className="muted">{asset.direction_name || "Без направления"} · {formatDate(asset.created_at)} · {asset.mime} · {asset.width}×{asset.height} · {asset.byte_size} байт</p>
      <img className="creative" src={`/api/creatives/${asset.id}/file`} alt={asset.name} />
      <p><a href={`/api/creatives/${asset.id}/file`}>Скачать оригинал</a></p>
      {asset.user_comment ? <p>{asset.user_comment}</p> : null}
      {data.reviews.length === 0 ? <p className="muted">Разборов нет.</p> : data.reviews.map((review) => (
        <section className="panel" key={String(review.id)}>
          <h2>{review.mode === "vision" ? "Экспертный разбор" : "Технические свойства"}</h2>
          <p className="notice">{String(review.disclaimer || "")}</p>
          {review.unavailable_reason ? <p>{String(review.unavailable_reason)}</p> : null}
          {review.overall_note ? <p>{String(review.overall_note)}</p> : null}
          <ul>
            {(review.criteria as Array<{ id: string; title: string; score?: number; fact?: string; explanation: string; issues?: string[]; recommendations?: string[] }>).map((criterion) => (
              <li key={criterion.id}>
                <b>{criterion.title}{criterion.score ? `: ${criterion.score}/10` : ""}</b>
                {criterion.fact ? ` ${criterion.fact}` : ""} {criterion.explanation}
              </li>
            ))}
          </ul>
          <Lines title="Сильные стороны" items={review.strengths as string[]} />
          <Lines title="Слабые стороны" items={review.weaknesses as string[]} />
          <Lines title="Критичные замечания" items={review.critical as string[]} />
          <Lines title="Что изменить" items={review.recommendations as string[]} />
        </section>
      ))}
      {others.length ? (
        <section className="panel">
          <h2>Сравнить</h2>
          <ul>
            {others.map((item) => <li key={item.id}><Link href={`/creatives/compare?ids=${asset.id},${item.id}`}>{item.name}</Link></li>)}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function Lines({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (<><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></>);
}

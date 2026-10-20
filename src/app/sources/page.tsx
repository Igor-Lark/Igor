import { SourceLinkForm } from "@/components/Forms";
import { RELIABILITY_LABELS, SOURCE_TYPE_LABELS, formatDate } from "@/lib/labels";
import { options, sourceList } from "@/server/read/catalog";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const sources = sourceList({ directionId: params.direction, query: params.q }) as Array<{ id: string; title: string; url: string | null; source_type: string; reliability: string; accessed_at: string; published_at: string | null; unavailable: number; directions: string | null }>;
  const { directions } = options();
  return (
    <>
      <h1>Источники</h1>
      <p className="lede">Каталог того, что действительно удалось получить или что отметил пользователь. Пустые даты публикации не заполняются догадкой.</p>
      <form className="filters" method="get">
        <input name="q" defaultValue={params.q || ""} placeholder="Название или URL" />
        <select name="direction" defaultValue={params.direction || ""}>
          <option value="">Все направления</option>
          {directions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button>Показать</button>
      </form>
      {sources.length === 0 ? <p className="muted">Источников пока нет.</p> : sources.map((source) => (
        <article className="panel" key={source.id}>
          <h2>{source.title} {source.unavailable ? "· недоступен" : ""}</h2>
          <p>{source.url ? <a href={source.url}>{source.url}</a> : "URL нет"}</p>
          <p className="muted">{SOURCE_TYPE_LABELS[source.source_type] || source.source_type} · {RELIABILITY_LABELS[source.reliability] || source.reliability} · публикация: {source.published_at || "дата неизвестна"} · обращение: {formatDate(source.accessed_at)}</p>
          <p className="muted">Направления: {source.directions || "не связаны"}</p>
          <SourceLinkForm sourceId={source.id} directions={directions} />
        </article>
      ))}
    </>
  );
}

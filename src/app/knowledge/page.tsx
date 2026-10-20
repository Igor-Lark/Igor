import { FactConfirm } from "@/components/Forms";
import { knowledgeData } from "@/server/read/catalog";

export default function KnowledgePage() {
  const data = knowledgeData() as {
    site: { description: string; positioning: string; content_rules: string; seo_rules: string } | undefined;
    notes: Array<{ id: string; title: string; body: string; scope: string; direction_name: string | null; source_url: string | null }>;
    facts: Array<{ id: string; label: string; value: string; confirmed: number; direction_name: string | null; source_note: string }>;
  };
  return (
    <>
      <h1>База знаний</h1>
      <p className="lede">Общие сведения сайта и отдельные заметки направлений. Стартовые коммерческие условия сняты с публичной страницы и не подтверждены, пока вы сами их не отметите.</p>
      {data.site ? (
        <section className="panel">
          <h2>Сайт</h2>
          <p>{data.site.description}</p>
          <p>{data.site.positioning}</p>
          <p>{data.site.content_rules}</p>
          <p>{data.site.seo_rules}</p>
        </section>
      ) : <p className="muted">Карточка сайта ещё не заполнена.</p>}
      <section className="panel">
        <h2>Заметки</h2>
        {data.notes.map((note) => (
          <article key={note.id}>
            <h3>{note.title}</h3>
            <p className="muted">{note.scope === "site" ? "Весь сайт" : note.direction_name} {note.source_url ? `· ${note.source_url}` : ""}</p>
            <p className="text-block">{note.body}</p>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Коммерческие условия</h2>
        <table>
          <thead><tr><th>Направление</th><th>Условие</th><th>Значение</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {data.facts.map((fact) => (
              <tr key={fact.id}>
                <td>{fact.direction_name || "Сайт"}</td>
                <td>{fact.label}<div className="muted">{fact.source_note}</div></td>
                <td>{fact.value}</td>
                <td>{fact.confirmed ? "Подтверждено" : "Не подтверждено"}</td>
                <td>{fact.confirmed ? null : <FactConfirm id={fact.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

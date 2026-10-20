import Link from "next/link";
import { PageForm } from "@/components/Forms";
import { formatDate } from "@/lib/labels";
import { listPages, options } from "@/server/read/catalog";

export default function PagesPage() {
  const pages = listPages() as Array<{ id: string; title: string; url: string; direction_name: string | null; fetched_at: string | null }>;
  const { directions } = options();
  return (
    <>
      <h1>Страницы сайта</h1>
      <p className="lede">Загрузчик принимает только boat-sochi.ru. Внешние источники собираются отдельно, в исследовании.</p>
      <table>
        <thead><tr><th>Страница</th><th>Направление</th><th>Последний снимок</th></tr></thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.id}>
              <td><Link href={`/pages/${page.id}`}>{page.title}</Link><div className="muted">{page.url}</div></td>
              <td>{page.direction_name || "Общая"}</td>
              <td>{formatDate(page.fetched_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="panel">
        <h2>Добавить страницу</h2>
        <PageForm directions={directions} />
      </section>
    </>
  );
}

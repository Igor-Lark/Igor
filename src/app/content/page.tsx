import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/labels";
import { contentList } from "@/server/read/catalog";

export default function ContentPage() {
  const versions = contentList() as Array<{ id: string; title: string; page_title: string; direction_name: string | null; kind: string; origin: string; approval_status: string; created_at: string }>;
  return (
    <>
      <h1>Контент и SEO</h1>
      <p className="lede">Здесь версии текстов и статус их внутренней проверки. Согласование не публикует страницу.</p>
      {versions.length === 0 ? <p className="muted">Версий пока нет. Сначала получите снимок страницы и создайте задачу на текст или SEO.</p> : (
        <table>
          <thead><tr><th>Версия</th><th>Страница</th><th>Происхождение</th><th>Статус</th><th>Дата</th></tr></thead>
          <tbody>
            {versions.map((version) => (
              <tr key={version.id}>
                <td><Link href={`/content/${version.id}`}>{version.title || version.page_title}</Link></td>
                <td>{version.page_title}<div className="muted">{version.direction_name || "Общая"}</div></td>
                <td>{version.kind === "original" ? "снимок" : version.origin === "user" ? "пользователь" : "модель"}</td>
                <td><StatusBadge status={version.approval_status} /></td>
                <td>{formatDate(version.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

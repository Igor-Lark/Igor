import Link from "next/link";
import { CreativeForm } from "@/components/Forms";
import { formatDate } from "@/lib/labels";
import { creativeList, options, promptList } from "@/server/read/catalog";

export default function CreativesPage() {
  const assets = creativeList() as Array<{ id: string; name: string; direction_name: string | null; width: number; height: number; format_label: string; created_at: string; latestReview: { mode: string; unavailable_reason: string | null } | null }>;
  const prompts = promptList() as Array<{ id: string; name: string; direction_name: string; origin: string; created_at: string }>;
  const data = options();
  return (
    <>
      <h1>Креативы и промпты</h1>
      <p className="lede">Оригинал изображения сохраняется без изменений. Если модель со зрением не настроена, приложение показывает только свойства файла и не ставит оценки.</p>
      <div className="split">
        <section className="panel">
          <h2>Изображения</h2>
          {assets.length === 0 ? <p className="muted">Файлов пока нет.</p> : (
            <ul>
              {assets.map((asset) => (
                <li key={asset.id}>
                  <Link href={`/creatives/${asset.id}`}>{asset.name}</Link>
                  <div className="muted">{asset.width}×{asset.height} · {asset.format_label || "формат не указан"} · {asset.direction_name || "без направления"} · {formatDate(asset.created_at)}</div>
                  <div className="muted">{asset.latestReview ? (asset.latestReview.mode === "vision" ? "есть экспертный разбор" : asset.latestReview.unavailable_reason || "только технические свойства") : "разбора нет"}</div>
                </li>
              ))}
            </ul>
          )}
          <CreativeForm directions={data.directions} pages={data.pages} />
        </section>
        <section className="panel">
          <h2>Промпты</h2>
          <p><Link href="/tasks/new?type=image_prompt">Собрать промпт</Link></p>
          {prompts.length === 0 ? <p className="muted">Промптов пока нет.</p> : prompts.map((prompt) => (
            <p key={prompt.id}><Link href={`/prompts/${prompt.id}`}>{prompt.name}</Link><span className="muted"> · {prompt.direction_name} · {prompt.origin === "llm" ? "уточнён моделью" : "собран из полей"}</span></p>
          ))}
        </section>
      </div>
    </>
  );
}

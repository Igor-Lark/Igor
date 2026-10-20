import { COMPARE_DISCLAIMER } from "@/lib/labels";
import { compareCreatives } from "@/server/creatives/store";

export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const ids = (params.ids || "").split(",").filter(Boolean);
  let data: ReturnType<typeof compareCreatives> | null = null;
  let error = "";
  try {
    data = compareCreatives(ids);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Не удалось сравнить.";
  }
  return (
    <>
      <h1>Сравнение креативов</h1>
      <p className="notice">{COMPARE_DISCLAIMER}</p>
      {error ? <p className="error">{error}</p> : null}
      {data ? (
        <div className="split">
          {data.items.map((item) => (
            <section className="panel" key={item.id}>
              <h2>{item.name}</h2>
              <img className="creative" src={`/api/creatives/${item.id}/file`} alt={item.name} />
              <p>{String(item.width)}×{String(item.height)} · {String(item.byteSize)} байт · {String(item.formatLabel || "формат не указан")}</p>
              {item.reviews.length === 0 ? <p>Разборов нет, сравнивать качество не из чего.</p> : item.reviews.map((review) => (
                <div key={review.id}>
                  <p><b>{review.mode === "vision" ? "Экспертный разбор" : "Технические свойства"}</b></p>
                  {review.unavailableReason ? <p>{review.unavailableReason}</p> : null}
                  <p>{review.overall}</p>
                  <p className="muted">{review.disclaimer}</p>
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : null}
    </>
  );
}

import { CopyButton } from "@/components/CopyButton";
import { DecisionForm } from "@/components/Forms";
import { StatusBadge } from "@/components/StatusBadge";
import { notFound } from "next/navigation";
import { adDetail } from "@/server/read/catalog";

export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = adDetail(id);
  if (!data) notFound();
  const concept = data.concept as { id: string; name: string; direction_name: string; goal: string; audience: string; season_label: string; offer: string; hypothesis: string; key_argument: string; format: string; constraints: string; visual_notes: string; approval_status: string };
  return (
    <>
      <h1>{concept.name}</h1>
      <p className="muted">{concept.direction_name} · <StatusBadge status={concept.approval_status} /></p>
      <CopyButton href={`/api/export/ad/${id}?format=md`} />
      <section className="panel">
        <p><b>Цель:</b> {concept.goal || "не указана"}</p>
        <p><b>Аудитория:</b> {concept.audience || "не указана"}</p>
        <p><b>Сезон:</b> {concept.season_label || "не указан"}</p>
        <p><b>Предложение:</b> {concept.offer || "не указано"}</p>
        <p><b>Гипотеза:</b> {concept.hypothesis || "не указана"}</p>
        <p><b>Аргумент:</b> {concept.key_argument || "не указан"}</p>
        <p><b>Формат:</b> {concept.format || "не указан"}</p>
        <p><b>Ограничения:</b> {concept.constraints || "нет"}</p>
        {concept.visual_notes ? <p className="text-block"><b>Визуальные заметки:</b> {concept.visual_notes}</p> : null}
      </section>
      {data.copies.map((copy) => (
        <section className="panel" key={String(copy.id)}>
          <h2>Тексты <StatusBadge status={String(copy.approval_status)} /> <span className="muted">{copy.origin === "user" ? "ввёл пользователь" : "модель"}</span></h2>
          <p>{String(copy.idea || "")}</p>
          <Lines title="Заголовки" items={copy.headlines} />
          <Lines title="Дополнительные заголовки" items={copy.extraHeadlines} />
          <Lines title="Тексты" items={copy.texts} />
          <Lines title="Короткие варианты" items={copy.shortVariants} />
          <Lines title="Призывы" items={copy.ctas} />
          <Lines title="Гипотезы" items={copy.hypotheses} />
          {copy.warnings.length ? <div className="notice">{copy.warnings.map((warning: string) => <p key={warning}>{warning}</p>)}</div> : null}
          <DecisionForm targetType="ad_copy" targetId={String(copy.id)} />
        </section>
      ))}
      <section className="panel">
        <h2>Решение по концепции</h2>
        <DecisionForm targetType="ad_concept" targetId={concept.id} />
      </section>
    </>
  );
}

function Lines({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <h3>{title}</h3>
      <ul>{items.length ? items.map((item) => <li key={item}>{item}</li>) : <li className="muted">Нет</li>}</ul>
    </>
  );
}

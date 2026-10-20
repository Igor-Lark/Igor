import Link from "next/link";
import { DirectionForm } from "@/components/Forms";
import { listDirections } from "@/server/read/catalog";

export default function DirectionsPage() {
  const directions = listDirections() as Array<{ id: string; name: string; description: string; pages: number; open_tasks: number }>;
  return (
    <>
      <h1>Направления</h1>
      <p className="lede">У каждой услуги свои страницы, задачи и материалы. Общие правила сайта лежат в базе знаний и не подменяют условия направления.</p>
      <div className="grid">
        {directions.map((direction) => (
          <Link key={direction.id} href={`/directions/${direction.id}`} className="card">
            <strong>{direction.name}</strong>
            <p>{direction.description}</p>
            <span className="muted">Страниц: {direction.pages}. Открытых задач: {direction.open_tasks}.</span>
          </Link>
        ))}
      </div>
      <section className="panel">
        <h2>Новое направление</h2>
        <DirectionForm />
      </section>
    </>
  );
}

import { TaskForm } from "@/components/Forms";
import { options } from "@/server/read/catalog";

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const data = options();
  return (
    <>
      <h1>Новая задача</h1>
      <p className="lede">Тип задаёт свой набор данных. Запуск одной задачи не останавливает остальные.</p>
      <section className="panel">
        <TaskForm
          directions={data.directions}
          pages={data.pages}
          assets={data.assets}
          defaults={{ directionId: params.direction, pageId: params.page, parentTaskId: params.parent, type: params.type }}
        />
      </section>
    </>
  );
}

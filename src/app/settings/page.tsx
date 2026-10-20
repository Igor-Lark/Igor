import { settingsView } from "@/server/read/catalog";

export default function SettingsPage() {
  const settings = settingsView();
  return (
    <>
      <h1>Настройки</h1>
      <p className="lede">Ключи читаются только из окружения и на этой странице не показываются.</p>
      <section className="panel">
        <p>Текстовая модель: {settings.llmConfigured ? `настроена, ${settings.model}, ${settings.baseHost}` : "не настроена. Генерация текстов будет завершаться ошибкой, без подставного результата."}</p>
        <p>Модель со зрением: {settings.visionConfigured ? settings.visionModel : "не настроена. Оценки креативов не выставляются."}</p>
        <p>Веб-поиск: {settings.searchConfigured ? "Tavily настроен" : "не настроен. Исследование идёт только по URL, которые вы укажете."}</p>
        <p>Одновременно задач: {settings.maxConcurrent}</p>
        <p>Каталог данных: {settings.dataDir}</p>
      </section>
      <section className="panel">
        <h2>Что приложение не делает</h2>
        <ul>
          <li>Не публикует страницы boat-sochi.ru и не меняет Tilda.</li>
          <li>Не создаёт кампании, объявления, ставки и бюджеты в Яндекс Директе.</li>
          <li>Не подставляет фиктивные источники, цены и оценки, если внешний сервис не ответил.</li>
        </ul>
      </section>
      <section className="panel">
        <h2>Резервная копия</h2>
        <p>Остановите приложение и выполните <code>npm run backup</code>. Копия базы, снимков и загрузок появится в каталоге backups. Для восстановления остановите приложение и замените файл базы и папки uploads и snapshots содержимым копии.</p>
      </section>
    </>
  );
}

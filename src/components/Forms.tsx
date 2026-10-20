"use client";

import { TYPE_LABELS, type TaskType } from "@/lib/labels";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Option = { id: string; name?: string; title?: string; direction_id?: string | null };

function useSend() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function send(url: string, body: unknown) {
    setPending(true);
    setError("");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Не удалось сохранить.");
      return null;
    }
    router.refresh();
    return data as Record<string, unknown>;
  }
  return { send, error, pending, setError };
}

export function DirectionForm() {
  const { send, error, pending } = useSend();
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await send("/api/directions", { name: form.get("name"), description: form.get("description") });
        if (result) event.currentTarget.reset();
      }}
    >
      <label>Название<input name="name" required /></label>
      <label>Описание<textarea name="description" /></label>
      <button disabled={pending}>Добавить направление</button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function DirectionEdit({ id, name, description }: { id: string; name: string; description: string }) {
  const { send, error, pending } = useSend();
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await send(`/api/directions/${id}`, { name: form.get("name"), description: form.get("description") });
      }}
    >
      <label>Название<input name="name" defaultValue={name} required /></label>
      <label>Описание<textarea name="description" defaultValue={description} /></label>
      <button disabled={pending}>Сохранить описание</button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function PageForm({ directions }: { directions: Option[] }) {
  const router = useRouter();
  const { send, error, pending } = useSend();
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await send("/api/pages", {
          url: form.get("url"),
          title: form.get("title"),
          description: form.get("description"),
          directionId: form.get("directionId"),
          fetchNow: form.get("fetchNow") === "on",
        });
        if (result?.taskId) router.push(`/tasks/${result.taskId}`);
        else if (result?.id) router.push(`/pages/${result.id}`);
      }}
    >
      <label>URL страницы boat-sochi.ru<input name="url" placeholder="https://boat-sochi.ru/..." required /></label>
      <label>Название<input name="title" required /></label>
      <label>Описание<textarea name="description" /></label>
      <label>
        Направление
        <select name="directionId" defaultValue="">
          <option value="">Общая страница сайта</option>
          {directions.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>
      <label className="row"><input type="checkbox" name="fetchNow" defaultChecked /> Сразу получить содержимое</label>
      <button disabled={pending}>Добавить страницу</button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function FetchPageButton({ pageId, directionId, title }: { pageId: string; directionId: string | null; title: string }) {
  const router = useRouter();
  const { send, error, pending } = useSend();
  return (
    <div>
      <button
        disabled={pending}
        onClick={async () => {
          const result = await send("/api/tasks", {
            type: "page_fetch",
            title: `Снимок: ${title}`,
            pageId,
            directionId,
            input: {},
          });
          if (result?.id) router.push(`/tasks/${result.id}`);
        }}
      >
        Получить страницу
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

export function TaskForm({
  directions,
  pages,
  assets,
  defaults,
}: {
  directions: Option[];
  pages: Array<Option & { url?: string }>;
  assets: Option[];
  defaults?: { directionId?: string; pageId?: string; parentTaskId?: string; type?: string };
}) {
  const router = useRouter();
  const { send, error, pending } = useSend();
  const [type, setType] = useState<TaskType>((defaults?.type as TaskType) || "research");
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (key.startsWith("input.")) input[key.slice(6)] = value;
    }
    if (form.get("input.refineWithLlm") === "on") input.refineWithLlm = true;
    const result = await send("/api/tasks", {
      type,
      title: form.get("title"),
      description: form.get("description"),
      directionId: form.get("directionId") || null,
      pageId: form.get("pageId") || null,
      parentTaskId: defaults?.parentTaskId || null,
      queue: form.get("queue") === "on",
      input,
    });
    if (result?.id) router.push(`/tasks/${result.id}`);
  }
  return (
    <form className="stack" onSubmit={onSubmit}>
      <label>
        Тип
        <select name="type" value={type} onChange={(event) => setType(event.target.value as TaskType)}>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label>Название<input name="title" required /></label>
      <label>Комментарий к задаче<textarea name="description" /></label>
      <label>
        Направление
        <select name="directionId" defaultValue={defaults?.directionId || ""}>
          <option value="">Не выбрано</option>
          {directions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>
        Страница
        <select name="pageId" defaultValue={defaults?.pageId || ""}>
          <option value="">Не выбрана</option>
          {pages.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      {type === "research" ? (
        <>
          <label>Цель<input name="input.goal" required /></label>
          <label>Поисковые запросы, по одному в строке<textarea name="input.queries" /></label>
          <label>URL источников, по одному в строке<textarea name="input.seedUrls" placeholder="https://..." /></label>
        </>
      ) : null}
      {type === "content_proposal" ? <label>Что изменить<textarea name="input.instruction" required /></label> : null}
      {type === "seo_analysis" ? <label>Запросы для сверки со страницей, если они у вас есть<textarea name="input.queries" /></label> : null}
      {type === "ad_copy" ? (
        <>
          <label>Режим
            <select name="input.mode" defaultValue="generate">
              <option value="generate">Сгенерировать тексты</option>
              <option value="manual">Сохранить введённые тексты</option>
            </select>
          </label>
          <label>Цель рекламы<input name="input.goal" /></label>
          <label>Аудитория<input name="input.audience" /></label>
          <label>Сезон или период<input name="input.season" /></label>
          <label>Предложение<input name="input.offer" /></label>
          <label>Гипотеза<input name="input.hypothesis" /></label>
          <label>Ключевой аргумент<input name="input.keyArgument" /></label>
          <label>Формат<input name="input.format" placeholder="Поиск или РСЯ" /></label>
          <label>Ограничения<textarea name="input.constraints" /></label>
          <label>Заголовки, если вводите сами<textarea name="input.headlines" /></label>
          <label>Тексты, если вводите сами<textarea name="input.texts" /></label>
        </>
      ) : null}
      {type === "image_prompt" ? (
        <>
          <label>Назначение<input name="input.purpose" /></label>
          <label>Формат<input name="input.targetFormat" placeholder="РСЯ 1:1, 1080×1080" /></label>
          <label>Основной объект<input name="input.subject" required /></label>
          <label>Что нельзя менять<textarea name="input.constraints" /></label>
          <label>Композиция<input name="input.composition" /></label>
          <label>Ракурс<input name="input.angle" /></label>
          <label>Окружение<input name="input.environment" /></label>
          <label>Свет<input name="input.lighting" /></label>
          <label>Погода<input name="input.weather" /></label>
          <label>Сезон<input name="input.season" /></label>
          <label>Место под текст<input name="input.textSpace" /></label>
          <label>Референс<textarea name="input.referenceNote" /></label>
          <label className="row"><input type="checkbox" name="input.refineWithLlm" /> Уточнить формулировку моделью, если она настроена</label>
        </>
      ) : null}
      {type === "creative_review" ? (
        <label>
          Загруженный креатив
          <select name="input.assetId" required defaultValue="">
            <option value="" disabled>Выберите файл</option>
            {assets.map((item) => <option key={item.id} value={item.id}>{item.name || item.title}</option>)}
          </select>
        </label>
      ) : null}
      <label className="row"><input type="checkbox" name="queue" defaultChecked /> Сразу поставить в очередь</label>
      <button disabled={pending}>Создать задачу</button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function TaskActions({ id, status }: { id: string; status: string }) {
  const { send, error, pending } = useSend();
  const act = (action: string) => send(`/api/tasks/${id}/action`, { action });
  return (
    <div className="row">
      {["queued", "scheduled", "running", "paused", "draft"].includes(status) ? (
        <button className="secondary" disabled={pending} onClick={() => act("cancel")}>Отменить</button>
      ) : null}
      {["queued", "scheduled", "running"].includes(status) ? (
        <button className="secondary" disabled={pending} onClick={() => act("pause")}>Пауза</button>
      ) : null}
      {status === "paused" || status === "draft" ? (
        <button disabled={pending} onClick={() => act(status === "draft" ? "queue" : "resume")}>В очередь</button>
      ) : null}
      {["error", "interrupted", "cancelled"].includes(status) ? (
        <button disabled={pending} onClick={() => act("retry")}>Повторить</button>
      ) : null}
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}

export function CommentForm({ id }: { id: string }) {
  const { send, error, pending } = useSend();
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await send(`/api/tasks/${id}/action`, { action: "comment", body: form.get("body") });
        if (result) event.currentTarget.reset();
      }}
    >
      <label>Комментарий<textarea name="body" required /></label>
      <button disabled={pending}>Добавить комментарий</button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function DecisionForm({ targetType, targetId }: { targetType: string; targetId: string }) {
  const { send, error, pending } = useSend();
  const [comment, setComment] = useState("");
  const decide = (decision: string) => send("/api/approvals", { targetType, targetId, decision, comment });
  return (
    <div className="stack">
      <label>Комментарий к решению<textarea value={comment} onChange={(event) => setComment(event.target.value)} /></label>
      <div className="row">
        <button disabled={pending} onClick={() => decide("approved")}>Согласовать</button>
        <button className="secondary" disabled={pending} onClick={() => decide("needs_revision")}>На доработку</button>
        <button className="secondary" disabled={pending} onClick={() => decide("rejected")}>Отклонить</button>
      </div>
      <p className="muted">Решение остаётся внутри приложения и ничего не публикует.</p>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

export function ObservationForm({ directions }: { directions: Option[] }) {
  const { send, error, pending } = useSend();
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await send("/api/observations", {
          directionId: form.get("directionId"),
          observedOn: form.get("observedOn"),
          periodLabel: form.get("periodLabel"),
          authorLabel: form.get("authorLabel"),
          body: form.get("body"),
        });
        if (result) event.currentTarget.reset();
      }}
    >
      <label>Дата наблюдения<input type="date" name="observedOn" required /></label>
      <label>Период, к которому относится<input name="periodLabel" placeholder="сентябрь 2026" /></label>
      <label>Кто сообщил<input name="authorLabel" placeholder="капитан, менеджер" /></label>
      <label>
        Направление
        <select name="directionId">
          <option value="">Не выбрано</option>
          {directions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>Наблюдение<textarea name="body" required /></label>
      <button disabled={pending}>Сохранить наблюдение</button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function FactConfirm({ id }: { id: string }) {
  const { send, error, pending } = useSend();
  return (
    <span>
      <button className="secondary" disabled={pending} onClick={() => send("/api/facts", { confirmId: id })}>Подтвердить</button>
      {error ? <span className="error">{error}</span> : null}
    </span>
  );
}

export function FactForm({ directionId }: { directionId?: string }) {
  const { send, error, pending } = useSend();
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await send("/api/facts", {
          directionId,
          kind: form.get("kind"),
          label: form.get("label"),
          value: form.get("value"),
          sourceNote: form.get("sourceNote"),
        });
        if (result) event.currentTarget.reset();
      }}
    >
      <label>Что это<select name="kind"><option value="price">Цена</option><option value="schedule">Расписание</option><option value="restriction">Ограничение</option><option value="other">Другое</option></select></label>
      <label>Название<input name="label" required /></label>
      <label>Значение<input name="value" required /></label>
      <label>Откуда известно<textarea name="sourceNote" required /></label>
      <button disabled={pending}>Добавить условие</button>
      <p className="muted">Новое условие сохраняется неподтверждённым.</p>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function RevisionForm({ parentVersionId, body }: { parentVersionId: string; body: string }) {
  const router = useRouter();
  const { send, error, pending } = useSend();
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await send("/api/content", {
          parentVersionId,
          body: form.get("body"),
          reason: form.get("reason"),
          titleTag: form.get("titleTag"),
          metaDescription: form.get("metaDescription"),
        });
        if (result?.id) router.push(`/content/${result.id}`);
      }}
    >
      <label>Новая версия текста<textarea name="body" defaultValue={body} required /></label>
      <label>Title<input name="titleTag" /></label>
      <label>Description<input name="metaDescription" /></label>
      <label>Почему меняете<input name="reason" /></label>
      <button disabled={pending}>Сохранить новую версию</button>
      <p className="muted">Новая версия не наследует согласование предыдущей.</p>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function CreativeForm({ directions, pages }: { directions: Option[]; pages: Option[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const response = await fetch("/api/creatives", { method: "POST", body: new FormData(event.currentTarget) });
        const data = await response.json().catch(() => ({}));
        setPending(false);
        if (!response.ok) {
          setError(data.error || "Файл не сохранён.");
          return;
        }
        if (data.taskId) router.push(`/tasks/${data.taskId}`);
        else router.push(`/creatives/${data.id}`);
      }}
    >
      <label>Название<input name="name" required /></label>
      <label>Файл JPG, PNG или WebP<input type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label>
      <label>
        Направление
        <select name="directionId">
          <option value="">Не выбрано</option>
          {directions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>
        Страница
        <select name="pageId">
          <option value="">Не выбрана</option>
          {pages.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <label>Заявленный формат<input name="formatLabel" placeholder="РСЯ 1:1" /></label>
      <label>Комментарий<textarea name="comment" /></label>
      <label className="row"><input type="checkbox" name="analyze" defaultChecked /> Разобрать после загрузки</label>
      <button disabled={pending}>Загрузить оригинал</button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function SourceLinkForm({ sourceId, directions }: { sourceId: string; directions: Option[] }) {
  const { send, error, pending } = useSend();
  return (
    <form
      className="row"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await send("/api/sources/link", { sourceId, directionId: form.get("directionId") });
      }}
    >
      <select name="directionId" required defaultValue="">
        <option value="" disabled>Связать с направлением</option>
        {directions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <button className="secondary" disabled={pending}>Связать</button>
      {error ? <span className="error">{error}</span> : null}
    </form>
  );
}

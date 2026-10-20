import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/server/db/client";
import { saveCreative } from "@/server/creatives/store";
import { exportMaterial } from "@/server/export/material";
import { pumpQueue, recoverInterruptedTasks } from "@/server/jobs/runner";
import { finishTask } from "@/server/jobs/finish";
import type { Handler } from "@/server/jobs/types";
import { decideMaterial, saveUserContentVersion } from "@/server/services/approval";
import { createDirection, createPage, createTask } from "@/server/services/tasks";
import { getTask } from "@/server/tasks/store";
import "./helpers";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function waitFor(check: () => boolean, timeout = 3000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeout) {
        clearInterval(timer);
        reject(new Error("условие не выполнилось"));
      }
    }, 15);
  });
}

describe("приёмка", () => {
  it("сохраняет направление и страницу после переоткрытия базы", () => {
    const directionId = createDirection("Прогулки на закате", "Сезонные выходы");
    const pageId = createPage({
      url: "https://boat-sochi.ru/progulki_na_yacht",
      title: "Парус",
      directionId,
    });
    closeDb();
    const direction = getDb().prepare("SELECT name FROM service_directions WHERE id = ?").get(directionId) as { name: string };
    const page = getDb().prepare("SELECT url FROM pages WHERE id = ?").get(pageId) as { url: string };
    expect(direction.name).toBe("Прогулки на закате");
    expect(page.url).toBe("https://boat-sochi.ru/progulki_na_yacht");
  });

  it("выполняет независимые задачи параллельно и не роняет остальные из-за одной ошибки", async () => {
    const fishing = createDirection("Рыбалка");
    const tigger = createDirection("Tigger");
    const sailing = createDirection("Парус");
    process.env.BCF_MAX_CONCURRENT_TASKS = "3";
    const assetId = saveCreative({ bytes: PNG, name: "Парус", directionId: sailing });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const research: Handler = async (task) => {
      await gate;
      finishTask(task.id, "completed", { kind: "research", summary: "готово" }, []);
    };
    const failing: Handler = async () => {
      throw new Error("Внешний API недоступен");
    };
    const season = createTask({
      type: "research",
      title: "Сезонность рыбалки",
      directionId: fishing,
      input: { goal: "Когда клюёт ставрида" },
    });
    const holiday = createTask({
      type: "ad_copy",
      title: "Новый год Tigger",
      directionId: tigger,
      input: { goal: "Праздничный чартер", mode: "manual", headlines: ["Яхта целиком"], texts: ["Частный выход"] },
    });
    const creative = createTask({
      type: "creative_review",
      title: "Креатив паруса",
      directionId: sailing,
      input: { assetId },
    });
    const running = pumpQueue({ handlers: { research, ad_copy: failing } });
    await waitFor(() => getTask(season.id)?.status === "running" && getTask(creative.id)?.status === "awaiting_review");
    expect(getTask(holiday.id)?.status).toBe("error");
    expect(getTask(holiday.id)?.errorMessage).toContain("Внешний API");
    release();
    await Promise.all(running);
    expect(getTask(season.id)?.status).toBe("completed");
    expect(getTask(creative.id)?.status).toBe("awaiting_review");
    const review = getDb().prepare("SELECT mode, criteria_json, unavailable_reason FROM creative_reviews WHERE asset_id = ?").get(assetId) as {
      mode: string;
      criteria_json: string;
      unavailable_reason: string;
    };
    expect(review.mode).toBe("technical_only");
    expect(review.criteria_json).not.toContain('"score"');
    expect(review.unavailable_reason).toContain("OPENAI_VISION_MODEL");
    expect(() => saveCreative({ bytes: Buffer.from("not an image"), name: "текст" })).toThrow(/JPG, PNG или WebP/);
  });

  it("после перезапуска помечает выполнявшуюся задачу прерванной и не запускает её сам", () => {
    const directionId = createDirection("Рыбалка");
    const task = createTask({
      type: "research",
      title: "Повтор сезона",
      directionId,
      input: { goal: "Осень" },
      queue: false,
    });
    getDb().prepare("UPDATE tasks SET status = 'running', started_at = ? WHERE id = ?").run(new Date().toISOString(), task.id);
    expect(recoverInterruptedTasks()).toBe(1);
    const restored = getTask(task.id);
    expect(restored?.status).toBe("interrupted");
    expect(restored?.errorMessage).toContain("не запускалась повторно");
    expect(pumpQueue()).toHaveLength(0);
    const events = getDb().prepare("SELECT kind FROM task_events WHERE task_id = ?").all(task.id) as Array<{ kind: string }>;
    expect(events.map((event) => event.kind)).toContain("interrupted");
  });

  it("не создаёт отчёт исследования без источников и не выдумывает факты", async () => {
    const directionId = createDirection("Рыбалка");
    const empty = createTask({
      type: "research",
      title: "Пустое исследование",
      directionId,
      input: { goal: "Сезон камбалы", queries: "камбала сочи" },
    });
    await Promise.all(pumpQueue());
    expect(getTask(empty.id)?.status).toBe("error");
    expect(getTask(empty.id)?.errorMessage).toContain("Отчёт не создан");
    expect((getDb().prepare("SELECT COUNT(*) AS c FROM research_reports").get() as { c: number }).c).toBe(0);

    const sourced = createTask({
      type: "research",
      title: "Исследование со ссылкой",
      directionId,
      input: { goal: "Сезон ставриды", seedUrls: "https://example.com/stavrida" },
    });
    await Promise.all(
      pumpQueue({
        fetchExternal: async () => ({
          title: "Ставрида у Сочи",
          metaDescription: "",
          h1: "Ставрида",
          headings: [],
          links: [],
          text: "На странице сказано, что ставрида держится косяками осенью. Дата публикации не указана.",
          publishedAt: null,
          warnings: [],
          incomplete: false,
          httpStatus: 200,
          finalUrl: "https://example.com/stavrida",
          html: "<html></html>",
        }),
        llm: {
          configured: () => true,
          visionConfigured: () => false,
          complete: async () =>
            JSON.stringify({
              summary: "В полученном фрагменте речь об осенних косяках.",
              confirmedFacts: [
                { statement: "Фрагмент говорит об осенних косяках ставриды.", sourceUrls: ["https://example.com/stavrida"] },
                { statement: "Выдуманный факт.", sourceUrls: ["https://invented.example/no"] },
              ],
              contradictions: [],
              uncertainties: ["Одного источника мало."],
              recommendations: [{ statement: "Проверить наблюдением капитана.", isHypothesis: true }],
              applicationNotes: "Не переносить в текст страницы без проверки.",
            }),
        },
      }),
    );
    const task = getTask(sourced.id);
    expect(task?.status).toBe("awaiting_review");
    const report = getDb().prepare("SELECT confirmed_facts_json, conducted_at FROM research_reports WHERE task_id = ?").get(sourced.id) as {
      confirmed_facts_json: string;
      conducted_at: string;
    };
    expect(report.conducted_at).toBeTruthy();
    expect(report.confirmed_facts_json).toContain("осенних косяках");
    expect(report.confirmed_facts_json).not.toContain("invented.example");
    expect(task?.warnings.join(" ")).toContain("убраны ссылки");
  });

  it("хранит исходный и предложенный текст, доработку и внутреннее согласование", async () => {
    const directionId = createDirection("Парус");
    const pageId = createPage({ url: "https://boat-sochi.ru/progulki_na_yacht", title: "Парус", directionId });
    getDb()
      .prepare(
        `INSERT INTO page_snapshots (
          id, page_id, fetched_at, http_status, final_url, title_tag, meta_description, h1, headings_json,
          text_content, links_json, published_at, incomplete, warnings_json, html_path
        ) VALUES ('snap', ?, ?, 200, ?, 'Парус', '', 'Прогулка', '[]', ?, '[]', NULL, 0, '[]', NULL)`,
      )
      .run(pageId, new Date().toISOString(), "https://boat-sochi.ru/progulki_na_yacht", "Групповая прогулка 1,5 часа. Билет 1 800 ₽.");
    const task = createTask({
      type: "content_proposal",
      title: "Осенний текст",
      directionId,
      pageId,
      input: { instruction: "Уточни, что это групповой билет." },
    });
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    await Promise.all(
      pumpQueue({
        llm: {
          configured: () => true,
          visionConfigured: () => false,
          complete: async () =>
            JSON.stringify({
              title: "Групповая прогулка",
              body: "Место в группе на 1,5 часа. Билет 1 800 ₽. Выдуманная цена 9 999 ₽.",
              titleTag: "Парус в Сириусе",
              metaDescription: "Групповой билет",
              reason: "Явно сказать, что это не аренда яхты целиком.",
              changeExplanation: "Добавлено пояснение формата.",
            }),
        },
      }),
    );
    expect(network).not.toHaveBeenCalled();
    const proposal = getDb().prepare("SELECT id, body, parent_version_id, approval_status FROM content_versions WHERE task_id = ? AND kind = 'proposal'").get(task.id) as {
      id: string;
      body: string;
      parent_version_id: string;
      approval_status: string;
    };
    const original = getDb().prepare("SELECT body FROM content_versions WHERE id = ?").get(proposal.parent_version_id) as { body: string };
    expect(original.body).toContain("1 800");
    expect(proposal.body).toContain("Место в группе");
    expect(getTask(task.id)?.warnings.join(" ")).toContain("9 999");
    const revised = saveUserContentVersion({ parentVersionId: proposal.id, body: "Только групповой билет, без новой цены.", reason: "Убрать лишнюю цену" });
    expect(getDb().prepare("SELECT approval_status FROM content_versions WHERE id = ?").get(revised)).toMatchObject({ approval_status: "draft" });
    decideMaterial({ targetType: "content_version", targetId: proposal.id, decision: "approved", comment: "Берём в работу" });
    expect(network).not.toHaveBeenCalled();
    const approved = getDb().prepare("SELECT approval_status FROM content_versions WHERE id = ?").get(proposal.id) as { approval_status: string };
    expect(approved.approval_status).toBe("approved");
    expect((getDb().prepare("SELECT decision FROM approval_events WHERE target_id = ?").get(proposal.id) as { decision: string }).decision).toBe("approved");
    expect(getDb().prepare("SELECT status FROM tasks WHERE id = ?").get(task.id)).toMatchObject({ status: "approved" });
    const exported = exportMaterial("content", proposal.id, "md");
    expect(exported.body).toContain("Место в группе");
    expect(exported.body).toContain("Групповая прогулка 1,5 часа");
    expect(network).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("сохраняет рекламу в своём направлении и не смешивает её с другим", async () => {
    const fishing = createDirection("Рыбалка");
    const tigger = createDirection("Tigger");
    const task = createTask({
      type: "ad_copy",
      title: "Tigger на праздник",
      directionId: tigger,
      input: {
        mode: "manual",
        goal: "Праздничный частный чартер",
        headlines: ["Яхта Tigger целиком"],
        texts: ["Частный выход, не групповой билет"],
        hypotheses: ["Гости ищут яхту на компанию"],
      },
    });
    await Promise.all(pumpQueue());
    const concept = getDb().prepare("SELECT id, direction_id, goal FROM advertising_concepts WHERE task_id = ?").get(task.id) as {
      id: string;
      direction_id: string;
      goal: string;
    };
    expect(concept.direction_id).toBe(tigger);
    expect(concept.goal).toContain("частный");
    const fishingAds = getDb().prepare("SELECT COUNT(*) AS c FROM advertising_concepts WHERE direction_id = ?").get(fishing) as { c: number };
    expect(fishingAds.c).toBe(0);
    const exported = exportMaterial("ad", concept.id, "json");
    expect(exported.body).toContain("Яхта Tigger целиком");
    expect(getDb().prepare("SELECT origin FROM ad_copy_versions WHERE concept_id = ?").get(concept.id)).toMatchObject({ origin: "user" });
  });

  it("собирает промпт из полей без вызова модели", async () => {
    const directionId = createDirection("Tigger");
    const network = vi.fn(() => {
      throw new Error("сеть не нужна");
    });
    vi.stubGlobal("fetch", network);
    const task = createTask({
      type: "image_prompt",
      title: "Промпт Tigger",
      directionId,
      input: { subject: "яхта Tigger у причала", constraints: "не менять количество палуб", targetFormat: "РСЯ 1:1" },
    });
    await Promise.all(pumpQueue());
    const prompt = getDb().prepare("SELECT prompt_text, origin FROM image_prompts WHERE task_id = ?").get(task.id) as { prompt_text: string; origin: string };
    expect(prompt.origin).toBe("structured");
    expect(prompt.prompt_text).toContain("яхта Tigger у причала");
    expect(prompt.prompt_text).toContain("не менять количество палуб");
    expect(network).not.toHaveBeenCalled();
    const file = exportMaterial("prompt", String((getTask(task.id)?.result as { promptId: string }).promptId), "txt");
    expect(file.body).toContain("яхта Tigger у причала");
    vi.unstubAllGlobals();
  });
});

describe("файлы креатива остаются на диске", () => {
  it("пишет оригинал байт в байт", () => {
    const directionId = createDirection("Парус");
    const id = saveCreative({ bytes: PNG, name: "квадрат", directionId });
    const row = getDb().prepare("SELECT storage_path FROM creative_assets WHERE id = ?").get(id) as { storage_path: string };
    const stored = fs.readFileSync(path.join(process.env.BCF_DATA_DIR || "", row.storage_path));
    expect(stored.equals(PNG)).toBe(true);
  });
});

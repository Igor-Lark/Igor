import { getDb, parseJson } from "../db/client";

export function exportMaterial(kind: string, id: string, format: string): { filename: string; contentType: string; body: string } {
  if (!["md", "txt", "json"].includes(format)) throw new Error("Формат: md, txt или json.");
  const data = build(kind, id);
  const filename = `${kind}-${id.slice(0, 8)}.${format === "txt" ? "txt" : format}`;
  if (format === "json") {
    return { filename, contentType: "application/json; charset=utf-8", body: JSON.stringify(data, null, 2) };
  }
  const text = format === "txt" ? data.markdown.replace(/^#+\s/gm, "") : data.markdown;
  return { filename, contentType: "text/plain; charset=utf-8", body: text };
}

function build(kind: string, id: string): { markdown: string } {
  if (kind === "research") return { markdown: researchMarkdown(id) };
  if (kind === "content") return { markdown: contentMarkdown(id) };
  if (kind === "ad") return { markdown: adMarkdown(id) };
  if (kind === "prompt") return { markdown: promptMarkdown(id) };
  throw new Error("Неизвестный тип экспорта.");
}

function researchMarkdown(id: string): string {
  const report = getDb().prepare("SELECT * FROM research_reports WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!report) throw new Error("Отчёт не найден.");
  const sources = getDb()
    .prepare(
      `SELECT s.title, s.url, s.published_at, s.accessed_at, s.source_type, s.reliability_note, s.unavailable
       FROM sources s JOIN report_sources rs ON rs.source_id = s.id WHERE rs.report_id = ?`,
    )
    .all(id) as Array<Record<string, unknown>>;
  const facts = parseJson<Array<{ statement: string; sourceUrls?: string[] }>>(String(report.confirmed_facts_json), []);
  const contradictions = parseJson<Array<{ statement: string }>>(String(report.contradictions_json), []);
  const uncertainties = parseJson<string[]>(String(report.uncertainties_json), []);
  const recommendations = parseJson<Array<{ statement: string; isHypothesis?: boolean }>>(String(report.recommendations_json), []);
  return [
    `# Исследование`,
    ``,
    `Цель: ${report.goal}`,
    `Дата: ${report.conducted_at}`,
    `Режим: ${report.synthesis_mode === "llm" ? "синтез по полученным источникам" : "только фрагменты, без выводов модели"}`,
    ``,
    `## Краткий вывод`,
    String(report.summary || "Нет."),
    ``,
    `## Подтверждённые факты`,
    facts.length ? facts.map((fact) => `- ${fact.statement}${fact.sourceUrls?.length ? ` (${fact.sourceUrls.join(", ")})` : ""}`).join("\n") : "Нет пунктов, связанных с полученными источниками.",
    ``,
    `## Противоречия`,
    contradictions.length ? contradictions.map((item) => `- ${item.statement}`).join("\n") : "Не зафиксированы.",
    ``,
    `## Неопределённости`,
    uncertainties.length ? uncertainties.map((item) => `- ${item}`).join("\n") : "Не зафиксированы.",
    ``,
    `## Рекомендации`,
    recommendations.length ? recommendations.map((item) => `- ${item.isHypothesis === false ? "" : "Гипотеза. "}${item.statement}`).join("\n") : "Нет.",
    ``,
    `## Применение`,
    String(report.application_notes || "Не указано."),
    ``,
    `## Изменения относительно прошлого отчёта`,
    String(report.changes_vs_previous || "Нет."),
    ``,
    `## Источники`,
    sources.length
      ? sources
          .map((source) => `- ${source.title} — ${source.url || "без URL"}; публикация: ${source.published_at || "дата неизвестна"}; обращение: ${source.accessed_at}; ${source.reliability_note}`)
          .join("\n")
      : "Нет.",
  ].join("\n");
}

function contentMarkdown(id: string): string {
  const version = getDb().prepare("SELECT * FROM content_versions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!version) throw new Error("Версия не найдена.");
  const parent = version.parent_version_id
    ? (getDb().prepare("SELECT * FROM content_versions WHERE id = ?").get(version.parent_version_id) as Record<string, unknown> | undefined)
    : undefined;
  return [
    `# Предложение по странице`,
    ``,
    `Дата: ${version.created_at}`,
    `Статус согласования: ${version.approval_status}`,
    `Причина: ${version.reason || "не указана"}`,
    ``,
    `## Почему так`,
    String(version.change_explanation || "Нет пояснения."),
    ``,
    `## Исходная версия`,
    parent ? String(parent.body || "") : "Исходная версия не связана.",
    ``,
    `## Предложенная версия`,
    String(version.body || ""),
    ``,
    `Title: ${version.title_tag || "не предложен"}`,
    `Description: ${version.meta_description || "не предложено"}`,
    ``,
    `Источники: ${version.sources_json}`,
  ].join("\n");
}

function adMarkdown(id: string): string {
  const concept = getDb().prepare("SELECT * FROM advertising_concepts WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!concept) throw new Error("Концепция не найдена.");
  const copies = getDb().prepare("SELECT * FROM ad_copy_versions WHERE concept_id = ? ORDER BY created_at").all(id) as Array<Record<string, unknown>>;
  const blocks = copies.map((copy, index) => {
    const headlines = parseJson<string[]>(String(copy.headlines_json), []);
    const extras = parseJson<string[]>(String(copy.extra_headlines_json), []);
    const texts = parseJson<string[]>(String(copy.texts_json), []);
    const shorts = parseJson<string[]>(String(copy.short_variants_json), []);
    const ctas = parseJson<string[]>(String(copy.ctas_json), []);
    const hypotheses = parseJson<string[]>(String(copy.hypotheses_json), []);
    return [
      `## Вариант ${index + 1} (${copy.origin}, ${copy.approval_status})`,
      `Заголовки:\n${headlines.map((item) => `- ${item}`).join("\n") || "- нет"}`,
      `Дополнительные заголовки:\n${extras.map((item) => `- ${item}`).join("\n") || "- нет"}`,
      `Тексты:\n${texts.map((item) => `- ${item}`).join("\n") || "- нет"}`,
      `Короткие варианты:\n${shorts.map((item) => `- ${item}`).join("\n") || "- нет"}`,
      `Призывы:\n${ctas.map((item) => `- ${item}`).join("\n") || "- нет"}`,
      `Идея: ${copy.idea || "нет"}`,
      `Гипотезы:\n${hypotheses.map((item) => `- ${item}`).join("\n") || "- нет"}`,
    ].join("\n\n");
  });
  return [
    `# ${concept.name}`,
    ``,
    `Цель: ${concept.goal || "не указана"}`,
    `Аудитория: ${concept.audience || "не указана"}`,
    `Сезон: ${concept.season_label || "не указан"}`,
    `Предложение: ${concept.offer || "не указано"}`,
    `Гипотеза концепции: ${concept.hypothesis || "не указана"}`,
    `Аргумент: ${concept.key_argument || "не указан"}`,
    `Формат: ${concept.format || "не указан"}`,
    `Ограничения: ${concept.constraints || "нет"}`,
    ``,
    blocks.join("\n\n") || "Текстов пока нет.",
  ].join("\n");
}

function promptMarkdown(id: string): string {
  const prompt = getDb().prepare("SELECT * FROM image_prompts WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!prompt) throw new Error("Промпт не найден.");
  return [`# ${prompt.name}`, ``, `Происхождение: ${prompt.origin}`, `Дата: ${prompt.created_at}`, ``, String(prompt.prompt_text)].join("\n");
}

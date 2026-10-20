export type SeoFinding = {
  code: string;
  severity: "info" | "warning";
  title: string;
  detail: string;
  heuristic: boolean;
};

export type SeoInput = {
  title: string;
  description: string;
  h1: string;
  headings: Array<{ level: number; text: string }>;
  text: string;
  links: Array<{ href: string }>;
  queries: string[];
  otherPages: Array<{ title: string; h1: string; url: string }>;
};

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-zа-яё0-9]+/i)
      .filter((word) => word.length > 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / new Set([...a, ...b]).size;
}

export function analyzeSeo(input: SeoInput): { findings: SeoFinding[]; preliminary: true } {
  const findings: SeoFinding[] = [];
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) {
    findings.push({ code: "title-missing", severity: "warning", title: "Нет Title", detail: "В снимке нет title.", heuristic: false });
  } else if (title.length < 25 || title.length > 65) {
    findings.push({
      code: "title-length",
      severity: "info",
      title: "Длина Title",
      detail: `Title длиной ${title.length} символов. Ориентир 25–65 — это эвристика, не требование поисковой системы.`,
      heuristic: true,
    });
  }
  if (!description) {
    findings.push({
      code: "description-missing",
      severity: "warning",
      title: "Нет Description",
      detail: "В снимке нет meta description.",
      heuristic: false,
    });
  } else if (description.length < 50 || description.length > 170) {
    findings.push({
      code: "description-length",
      severity: "info",
      title: "Длина Description",
      detail: `Description длиной ${description.length} символов. Ориентир 50–170 — эвристика.`,
      heuristic: true,
    });
  }
  const h1s = input.headings.filter((item) => item.level === 1);
  if (!input.h1 && h1s.length === 0) {
    findings.push({ code: "h1-missing", severity: "warning", title: "Нет H1", detail: "На странице не найден H1.", heuristic: false });
  }
  if (h1s.length > 1) {
    findings.push({
      code: "h1-many",
      severity: "warning",
      title: "Несколько H1",
      detail: `Найдено H1: ${h1s.length}.`,
      heuristic: false,
    });
  }
  let previous = 0;
  for (const heading of input.headings) {
    if (previous && heading.level > previous + 1) {
      findings.push({
        code: "heading-skip",
        severity: "info",
        title: "Скачок уровня заголовка",
        detail: `После H${previous} идёт H${heading.level}: «${heading.text.slice(0, 120)}».`,
        heuristic: true,
      });
      break;
    }
    previous = heading.level;
  }
  if (input.text.trim().length < 400) {
    findings.push({
      code: "thin-text",
      severity: "warning",
      title: "Мало текста в снимке",
      detail: "В сохранённом тексте меньше 400 символов. Если страница длиннее, снимок неполный и этот вывод предварительный.",
      heuristic: false,
    });
  }
  const paragraphs = input.text
    .split(/\n+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 80);
  const seen = new Map<string, number>();
  for (const paragraph of paragraphs) seen.set(paragraph, (seen.get(paragraph) || 0) + 1);
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1);
  if (duplicates.length) {
    findings.push({
      code: "duplicates",
      severity: "warning",
      title: "Повторяющиеся фрагменты",
      detail: `Одинаковых абзацев длиннее 80 символов: ${duplicates.length}.`,
      heuristic: false,
    });
  }
  if (input.links.length === 0) {
    findings.push({
      code: "no-internal-links",
      severity: "info",
      title: "Нет внутренних ссылок",
      detail: "В снимке не найдено ссылок на boat-sochi.ru.",
      heuristic: false,
    });
  }
  if (input.queries.length === 0) {
    findings.push({
      code: "no-queries",
      severity: "info",
      title: "Нет поисковых запросов",
      detail: "Частотность, позиции и прогноз трафика неизвестны: пользователь не передал запросы, а кабинет вебмастера не подключён.",
      heuristic: false,
    });
  } else {
    const haystack = `${title}\n${description}\n${input.h1}\n${input.text}`.toLowerCase();
    const lines = input.queries.map((query) => {
      const count = haystack.split(query.toLowerCase()).length - 1;
      return `«${query}»: ${count} вхождений в снимке`;
    });
    findings.push({
      code: "queries",
      severity: "info",
      title: "Переданные запросы",
      detail: `${lines.join("; ")}. Это наличие слов на странице, а не спрос и не позиция.`,
      heuristic: false,
    });
  }
  const own = tokens(`${input.h1} ${title}`);
  for (const page of input.otherPages) {
    const score = jaccard(own, tokens(`${page.h1} ${page.title}`));
    if (score >= 0.6) {
      findings.push({
        code: "overlap",
        severity: "warning",
        title: "Похожий заголовок другой страницы",
        detail: `Заголовки близки к ${page.url}. Это эвристика пересечения намерения, не данные поисковой выдачи.`,
        heuristic: true,
      });
    }
  }
  return { findings, preliminary: true };
}

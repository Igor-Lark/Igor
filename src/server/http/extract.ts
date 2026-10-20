import * as cheerio from "cheerio";

export type Heading = { level: number; text: string };
export type PageLink = { href: string; text: string };

export type ExtractedPage = {
  title: string;
  metaDescription: string;
  h1: string;
  headings: Heading[];
  links: PageLink[];
  text: string;
  publishedAt: string | null;
  warnings: string[];
  incomplete: boolean;
};

export function extractHtml(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html);
  const publishedAt =
    $('meta[property="article:published_time"]').attr("content")?.trim() ||
    $('meta[name="pubdate"]').attr("content")?.trim() ||
    null;
  $("script, style, noscript, iframe, svg").remove();
  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const metaDescription = ($('meta[name="description"]').attr("content") || "").replace(/\s+/g, " ").trim();
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  const headings: Heading[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;
    const tag = ("tagName" in el ? el.tagName : "h2").toString();
    headings.push({ level: Number(tag.replace(/\D/g, "")) || 2, text });
  });
  const links: PageLink[] = [];
  let host = "";
  try {
    host = new URL(pageUrl).host;
  } catch {
    host = "";
  }
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const url = new URL(href, pageUrl);
      if (!host || url.host !== host) return;
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      url.hash = "";
      const text = $(el).text().replace(/\s+/g, " ").trim().slice(0, 180);
      links.push({ href: url.toString(), text });
    } catch {
      // Битая ссылка не мешает остальному разбору.
    }
  });
  const text = $("body").text().replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const warnings: string[] = [];
  let incomplete = false;
  if (!title) warnings.push("Title не найден.");
  if (!metaDescription) warnings.push("Meta description не найдена.");
  if (!h1) warnings.push("H1 не найден.");
  if (text.length < 200) {
    incomplete = true;
    warnings.push("Извлечённого текста мало. Страница может собираться скриптом, либо ответ неполный. Недостающий текст не анализировался.");
  }
  const unique = new Map<string, PageLink>();
  for (const link of links) unique.set(link.href, link);
  return {
    title,
    metaDescription,
    h1,
    headings,
    links: [...unique.values()],
    text,
    publishedAt,
    warnings,
    incomplete,
  };
}

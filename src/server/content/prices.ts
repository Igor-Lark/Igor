const PRICE = /(\d[\d\s\u00a0]{0,12})\s*(?:₽|руб\.?)/gi;

export function findUnsourcedPrices(text: string, corpus: string): string[] {
  const allowed = corpus.replace(/[\s\u00a0]/g, "");
  const found = new Set<string>();
  for (const match of text.matchAll(PRICE)) {
    const digits = match[1].replace(/[\s\u00a0]/g, "");
    if (digits && !allowed.includes(digits)) found.add(match[0].replace(/\s+/g, " ").trim());
  }
  return [...found];
}

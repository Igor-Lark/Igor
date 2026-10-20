import { describe, expect, it } from "vitest";
import { findUnsourcedPrices } from "@/server/content/prices";
import { assemblePrompt } from "@/server/prompts/build";
import { analyzeSeo } from "@/server/seo/rules";

describe("правила без внешних сервисов", () => {
  it("помечает цену, которой не было в материалах", () => {
    expect(findUnsourcedPrices("Билет 1 800 ₽ и ещё 9 999 ₽", "Стоимость 1 800 ₽")).toEqual(["9 999 ₽"]);
  });

  it("разбирает снимок страницы и не выдумывает спрос", () => {
    const result = analyzeSeo({
      title: "",
      description: "",
      h1: "Прогулка",
      headings: [{ level: 1, text: "Прогулка" }, { level: 3, text: "Сразу третий" }],
      text: "Коротко.",
      links: [],
      queries: [],
      otherPages: [],
    });
    expect(result.preliminary).toBe(true);
    expect(result.findings.map((item) => item.code)).toEqual(expect.arrayContaining(["title-missing", "description-missing", "thin-text", "no-queries"]));
    expect(result.findings.some((item) => /частот|позиц/i.test(item.detail) && item.code !== "no-queries")).toBe(false);
  });

  it("собирает промпт только из переданных полей", () => {
    const prompt = assemblePrompt({ subject: "катамаран у пирса", constraints: "не добавлять гидроцикл" });
    expect(prompt).toContain("катамаран у пирса");
    expect(prompt).toContain("не добавлять гидроцикл");
    expect(prompt).toContain("не указано");
  });
});

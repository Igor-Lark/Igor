export type PromptFields = {
  name?: string;
  purpose?: string;
  targetFormat?: string;
  subject?: string;
  composition?: string;
  angle?: string;
  environment?: string;
  lighting?: string;
  weather?: string;
  season?: string;
  textSpace?: string;
  realism?: string;
  constraints?: string;
  referenceNote?: string;
};

export function assemblePrompt(fields: PromptFields): string {
  const line = (label: string, value?: string) => `${label}: ${value?.trim() || "не указано"}`;
  return [
    "Рекламное изображение для boat-sochi.ru. Используй только перечисленные сведения и не добавляй характеристики судна, цены и обещания.",
    line("Назначение", fields.purpose),
    line("Формат", fields.targetFormat),
    line("Основной объект", fields.subject),
    line("Что нельзя менять во внешнем виде", fields.constraints),
    line("Композиция", fields.composition),
    line("Ракурс", fields.angle),
    line("Окружение", fields.environment),
    line("Свет", fields.lighting),
    line("Погода", fields.weather),
    line("Сезон", fields.season),
    line("Свободное место под текст", fields.textSpace),
    line("Реалистичность", fields.realism),
    line("Референс", fields.referenceNote),
    "Без вымышленных логотипов, без нечитаемого текста на изображении и без чужих товарных знаков.",
  ].join("\n");
}

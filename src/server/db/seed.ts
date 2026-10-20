import type Database from "better-sqlite3";
import { logActivity } from "./activity";

const SOURCE = "https://boat-sochi.ru/llms.txt";
const SOURCE_NOTE =
  "Сведения взяты со страницы https://boat-sochi.ru/llms.txt, где указано «актуально 15.10.2026». В приложении факт не подтверждён, пока пользователь не отметит его.";

export function seedIfEmpty(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS c FROM websites").get() as { c: number };
  if (count.c > 0) return;
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO websites (
        id, host, name, description, positioning, content_rules, seo_rules, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "site-boat-sochi",
      "boat-sochi.ru",
      "boat-sochi.ru",
      "Сайт аренды яхт и катеров с капитаном в Сочи, Сириусе (Адлер) и Имеретинском порту. Публичные страницы собраны на Tilda. Цены на сайте названы информационными и не являются публичной офертой.",
      "Морские прогулки, групповые парусные билеты, групповая рыбалка, закат и частный чартер. Групповые билеты и частная аренда — разные продукты с разными телефонами.",
      "Не менять цены, расписание, вместимость и обещания без подтверждённого коммерческого факта. Не гарантировать дельфинов и улов. Не переносить тексты группового паруса в рекламу яхты Tigger. Детей считать пассажирами. Не предлагать форму заявки с якорем #bot.",
      "Не придумывать частотность, позиции и прогноз трафика. Рекомендации привязывать к конкретной странице и помечать пересечения с другими страницами.",
      now,
      now,
    );

    const directions: Array<[string, string, string, string]> = [
      [
        "dir-fishing",
        "fishing",
        "Групповая рыбалка",
        "Групповой билет на морскую рыбалку. Это отдельное направление: его тексты, цены и реклама не подставляются в парус и в аренду Tigger.",
      ],
      [
        "dir-sailing",
        "sailing",
        "Прогулки под парусом",
        "Групповые прогулки на парусной яхте, включая сезонные и праздничные предложения. Это билет в группу, а не частный чартер яхты Tigger.",
      ],
      [
        "dir-tigger",
        "tigger",
        "Аренда яхты Tigger",
        "Частная аренда яхты Tigger целиком. Материалы групповых прогулок под парусом сюда не переносятся без явного решения пользователя.",
      ],
    ];
    const insertDirection = db.prepare(
      `INSERT INTO service_directions (id, website_id, slug, name, description, created_at, updated_at)
       VALUES (?, 'site-boat-sochi', ?, ?, ?, ?, ?)`,
    );
    for (const [id, slug, name, description] of directions) {
      insertDirection.run(id, slug, name, description, now, now);
    }

    const pages: Array<[string, string | null, string, string, string]> = [
      ["page-home", null, "https://boat-sochi.ru/", "Главная — каталог флота", "Общая страница нескольких направлений. Не относится целиком ни к рыбалке, ни к парусу, ни к Tigger."],
      ["page-fishing", "dir-fishing", "https://boat-sochi.ru/gruppovaja_ribalka", "Групповая рыбалка", "Страница групповой морской рыбалки."],
      ["page-sailing", "dir-sailing", "https://boat-sochi.ru/progulki_na_yacht", "Прогулки под парусом", "Страница групповой прогулки на парусной яхте."],
      ["page-tigger", "dir-tigger", "https://boat-sochi.ru/yacht_tigger", "Яхта Tigger", "Страница частной аренды яхты Tigger."],
    ];
    const insertPage = db.prepare(
      `INSERT INTO pages (id, website_id, direction_id, url, title, description, created_at, updated_at)
       VALUES (?, 'site-boat-sochi', ?, ?, ?, ?, ?, ?)`,
    );
    for (const [id, directionId, url, title, description] of pages) {
      insertPage.run(id, directionId, url, title, description, now, now);
    }

    const note = db.prepare(
      `INSERT INTO knowledge_notes (id, scope, direction_id, title, body, source_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    note.run(
      "note-phones",
      "site",
      null,
      "Два телефона не смешивать",
      "По llms.txt индивидуальная аренда и Tigger относятся к телефону +7 917 675-05-55. Групповой парус и групповая рыбалка — к телефону +7 918 304-40-00. Если на странице в шапке указан другой номер, для ответа брать таблицу на llms.txt, а не угадывать.",
      SOURCE,
      now,
      now,
    );
    note.run(
      "note-morning-price",
      "site",
      null,
      "Утренняя цена катера «Сириус»: две формулировки",
      "На главной странице, просмотренной 20.10.2026, написано про скидку 500 ₽ за час утром с 9:00 до 12:00 и минимум 15 000 ₽ за 2 часа. На llms.txt (пометка «актуально 15.10.2026») та же сумма описана как 7 500 ₽/час и прямо запрещена формулировка «N × 8 000 − 500». Суммы сходятся, формулировки нет. Приложение не выбирает одну из них само.",
      SOURCE,
      now,
      now,
    );
    note.run(
      "note-rules",
      "site",
      null,
      "Общие правила, опубликованные сайтом",
      "Без животных. Без красных и красящих напитков. Прибытие за 10 минут. Дети считаются пассажирами. Мессенджеры могут работать нестабильно. Обычно выходы с 8:00 до 22:00, иное время по договорённости, круглый год. Эти правила относятся к сайту целиком и не заменяют условия конкретной услуги.",
      SOURCE,
      now,
      now,
    );
    note.run(
      "note-fishing",
      "direction",
      "dir-fishing",
      "Как описывать групповую рыбалку",
      "По llms.txt это билет: 2 800 ₽/чел., 3 часа, до 8 человек, слоты 9:30, 12:30 и 15:30. Снасти и капитан включены, улов готовят на борту, улов не гарантирован. Трофейный выход — отдельно, от 20 000 ₽ и от 3 часов. Телефон направления: +7 918 304-40-00. Не называть катрана.",
      SOURCE,
      now,
      now,
    );
    note.run(
      "note-sailing",
      "direction",
      "dir-sailing",
      "Как описывать групповой парус",
      "По llms.txt это место в группе, не аренда яхты целиком. 1,5 часа. День 1 800 ₽/чел., рейс 17:00 — 2 500 ₽. Слоты: 9:30, 11:00, 12:30, 14:00, 15:30, 17:00. Один ребёнок до 5 лет на яхту бесплатно, в 17:00 полная цена. Имя судна не называть. Дельфинов не гарантировать. Не вести на страницу утренних дельфинов и не подставлять телефон индивидуальной аренды. Телефон: +7 918 304-40-00.",
      SOURCE,
      now,
      now,
    );
    note.run(
      "note-tigger",
      "direction",
      "dir-tigger",
      "Как описывать Tigger",
      "По llms.txt Tigger — частный чартер целиком, линия 3 Имеретинского порта, 21,6 м, до 14 гостей, 50 000 ₽/час от 2 часов, 470 000 ₽/сутки. Телефон +7 917 675-05-55. Не использовать объявления группового паруса как готовые материалы Tigger.",
      SOURCE,
      now,
      now,
    );

    const fact = db.prepare(
      `INSERT INTO commercial_facts (
        id, direction_id, page_id, kind, label, value, source_note, source_url, confirmed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    );
    const facts: Array<[string, string, string, string, string, string]> = [
      ["fact-fish-price", "dir-fishing", "page-fishing", "price", "Цена билета", "2 800 ₽/чел."],
      ["fact-fish-time", "dir-fishing", "page-fishing", "duration", "Длительность", "3 часа"],
      ["fact-fish-cap", "dir-fishing", "page-fishing", "capacity", "Группа", "до 8 человек"],
      ["fact-fish-slots", "dir-fishing", "page-fishing", "schedule", "Слоты", "9:30, 12:30, 15:30"],
      ["fact-fish-place", "dir-fishing", "page-fishing", "departure", "Отправление", "Имеретинский порт, линия 2"],
      ["fact-fish-catch", "dir-fishing", "page-fishing", "restriction", "Улов", "Не гарантируется"],
      ["fact-sail-day", "dir-sailing", "page-sailing", "price", "Дневной билет", "1 800 ₽/чел."],
      ["fact-sail-sunset", "dir-sailing", "page-sailing", "price", "Рейс 17:00", "2 500 ₽/чел."],
      ["fact-sail-time", "dir-sailing", "page-sailing", "duration", "Длительность", "1,5 часа"],
      ["fact-sail-cap", "dir-sailing", "page-sailing", "capacity", "Группа", "до 11 человек"],
      ["fact-sail-slots", "dir-sailing", "page-sailing", "schedule", "Слоты", "9:30, 11:00, 12:30, 14:00, 15:30, 17:00"],
      ["fact-sail-name", "dir-sailing", "page-sailing", "restriction", "Название судна", "В групповом продукте имя яхты не называть"],
      ["fact-tigger-hour", "dir-tigger", "page-tigger", "price", "Час", "50 000 ₽/час, минимум 2 часа"],
      ["fact-tigger-day", "dir-tigger", "page-tigger", "price", "Сутки", "470 000 ₽/сутки"],
      ["fact-tigger-place", "dir-tigger", "page-tigger", "departure", "Отправление", "Имеретинский порт, линия 3"],
      ["fact-tigger-only", "dir-tigger", "page-tigger", "restriction", "Формат", "Только яхта целиком, не групповой билет"],
    ];
    for (const [id, directionId, pageId, kind, label, value] of facts) {
      fact.run(id, directionId, pageId, kind, label, value, SOURCE_NOTE, SOURCE, now, now);
    }
  });
  tx();
  logActivity({
    action: "seed",
    entityType: "website",
    entityId: "site-boat-sochi",
    message: "Созданы направления и неподтверждённые сведения по публичной странице llms.txt. Снимки страниц ещё не загружались.",
  });
}

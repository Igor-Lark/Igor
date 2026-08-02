# Проверка микроразметки marmara-pro.ru

## Быстрая проверка (Яндекс)

1. Откройте **https://webmaster.yandex.ru/tools/microtest/**
2. Проверьте URL:
   - `https://marmara-pro.ru/`
   - `https://marmara-pro.ru/termo`
   - (если дубль главной) `https://marmara-pro.ru/main`
3. Ожидаемые типы:
   - **/** и **/main:** `WebPage`, `WebSite`, `Organization`, `LocalBusiness`, `FAQPage`
   - **/termo:** + `Product`, `Service`, `BreadcrumbList`

После правок в Tilda — **опубликовать** сайт, подождать 5–15 минут.

## Локально (из репозитория)

```bash
cd sites/marmara-pro
./validate-markup.sh
./validate-markup.sh --live   # сравнить с опубликованным сайтом
```

## Schema.org Validator

- **https://validator.schema.org/**
- Вкладка «Code Snippet» — вставить содержимое `homepage-microdata.html` или `termo-microdata.html` (только `<script>...</script>`).

## llms.txt

- `https://marmara-pro.ru/llms.txt` — главная (корень домена)
- `https://marmara-pro.ru/llms-termo.txt` — каталог /termo

Если `llms-termo.txt` отдаёт 404 — загрузите файл из репозитория в корень сайта (Tilda: «Файлы» / свой хостинг).

## Вебmaster

**Индексирование → Структурированные данные** — статистика через 1–7 дней после переобхода.

**Переобход страниц:** `/`, `/termo`.

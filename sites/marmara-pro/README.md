# Marmara-pro.ru — микроразметка и llms

Файлы для **https://marmara-pro.ru/** и **https://marmara-pro.ru/termo** (только термопанели КлинкерПрофи).

| Файл | Назначение |
|------|------------|
| `homepage-microdata.html` | JSON-LD в `<head>` главной (`/` или `/main`) |
| `termo-microdata.html` | JSON-LD в `<head>` страницы `/termo` |
| `llms.txt` | Корень домена: `https://marmara-pro.ru/llms.txt` |
| `llms-termo.txt` | Каталог: `https://marmara-pro.ru/llms-termo.txt` (или ссылка из llms.txt) |

Проверка микроразметки: [YANDEX-CHECK.md](./YANDEX-CHECK.md) · `./validate-markup.sh --live`

Бот на VPS: обновление базы — `bots/klinkerpro-bot/scripts/deploy-knowledge.sh` (см. [DEPLOY.md](../../bots/klinkerpro-bot/DEPLOY.md)).
Бот КлинкерПрофи использует `bots/klinkerpro-bot/knowledge/site-home.md` и `site-termo.md` (+ FAQ).

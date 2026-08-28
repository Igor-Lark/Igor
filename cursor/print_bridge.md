# Мост печати Word → принтер

**23.08.2026 — агентам РК печать не нужна.** Word только в `cursor/`, ссылка в чат. Не вызывать `queue_print.py`, не класть файлы в `inbox/`.  
**28.08.2026 — промпт Leonardo:** prompt + negative одним блоком. Правило: `cursor/RK_agents_conventions.md`.

Ниже — как мост устроен, если печать снова попросят явно.

---

Облачный агент **не видит** принтер. Мост: агент кладёт `.docx` в `inbox/` **своей** ветки → watcher на ПК делает `git fetch` **всех** `origin/cursor/*` → печатает **односторонне**.

Живой клон на ПК: **`D:\CURSOR\print-bridge-git`**. Рядом может быть `D:\CURSOR\print-bridge` без git — watcher смотрит локальные `inbox` в обеих папках, но очередь агентов — **git `inbox/` на любой ветке `cursor/*`**.

Пользователя **не просить** копировать файлы в две папки на диске и не давать скрипты `drop-*-print.ps1`.

---

## Облачный агент (все РК)

По умолчанию **не печатать**. Если пользователь явно попросил бумагу:

```bash
python3 cursor/queue_print.py cursor/Имя_файла.docx
git add inbox/Имя_файла.docx cursor/Имя_файла.docx
```

Потом commit + push **своей** ветки.

Не писать «распечатал» — только «в очереди печати».

Если `queue_print.py` нет в ветке:

```bash
mkdir -p inbox && cp cursor/Файл.docx inbox/
```

и всё равно `git add inbox/Файл.docx` + push.

---

## Локальный ПК (один раз, потом автозагрузка)

Клон **обязан** видеть все ветки (не `--single-branch`):

```powershell
git -C D:\CURSOR\print-bridge-git pull
```

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*print-watch.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; powershell -ExecutionPolicy Bypass -File D:\CURSOR\print-bridge-git\install.ps1
```

Watcher каждые 60 сек: снимает single-branch, `fetch` всех веток, печатает новые `inbox/*.docx`, плюс локальные `inbox` в `print-bridge` и `print-bridge-git`.

Принтер: очередь Windows по умолчанию. Двустороннюю печать **выключить**.

---

## Имена файлов

- Анализ: `Analiz_RK_…_2026-08-16.docx`
- В inbox только Word, который нужен на бумаге. Не класть баннеры, CSV, скрины.

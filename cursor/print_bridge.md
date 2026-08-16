# Мост печати Word → принтер

Облачный агент **не видит** принтер. Мост: агент кладёт `.docx` в `inbox/` **своей** ветки → watcher на ПК делает `git fetch` **всех** `origin/cursor/*` → печатает **односторонне**.

Живой клон на ПК: **`D:\CURSOR\print-bridge-git`**. Рядом может быть `D:\CURSOR\print-bridge` без git — watcher смотрит локальные `inbox` в обеих папках, но очередь агентов — **git `inbox/` на любой ветке `cursor/*`**.

Пользователя **не просить** копировать файлы в две папки на диске и не давать скрипты `drop-*-print.ps1`.

## Где лежат файлы

Агенты **не пишут** в `D:\CURSOR\print-bridge\inbox` на диске. Они пушат `inbox/*.docx` в **GitHub на своей ветке**. В Проводнике папка пустая, пока watcher не сделал fetch — это нормально.

Смотреть очередь: GitHub → ветка агента → папка `inbox/`. На диске копии появятся в `D:\CURSOR\print-bridge-git\inbox` только после работы watcher (или `git pull` ветки моста).

---

## Облачный агент (все РК)

После любого Word, который нужен на бумаге:

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

Принтер: очередь Windows по умолчанию. Перед каждым заданием watcher ставит **OneSided** (односторонняя). Если всё равно двусторонне — в свойствах принтера по умолчанию выключить «печать с двух сторон».

---

## Имена файлов

- Анализ: `Analiz_RK_…_2026-08-16.docx`
- В inbox только Word, который нужен на бумаге. Не класть баннеры, CSV, скрины.

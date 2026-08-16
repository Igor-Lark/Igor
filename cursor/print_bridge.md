# Мост печати Word → принтер

Облачный агент **не видит** принтер. Мост: агент кладёт `.docx` в очередь → скрипт на ПК забирает и печатает **односторонне**.

Клон на ПК: **`D:\CURSOR\print-bridge`**  
Если эта папка занята (не git-клон / файл открыт) — **`D:\CURSOR\print-bridge-git`**  
Очередь: `inbox/` внутри клона

---

## Облачный агент (все РК)

После любого Word-анализа:

```bash
python3 cursor/queue_print.py cursor/Имя_файла.docx
```

Скрипт копирует файл в `inbox/`.  
Дальше: `git add` этой копии + исходный Word, commit, push **своей** ветки.

Не писать «распечатал» — только «в очереди печати». Печатает локальный мост.

Если `queue_print.py` нет в ветке:  
`mkdir -p inbox && cp cursor/Файл.docx inbox/`

---

## Локальный ПК (один раз, потом автозагрузка)

1. Если папки `D:\CURSOR\print-bridge` ещё нет — один блок в PowerShell (клонирует и ставит автозагрузку):

```powershell
irm https://raw.githubusercontent.com/Igor-Lark/Igor/cursor/print-bridge-4385/bootstrap-print-bridge.ps1 | iex
```

2. Если `D:\CURSOR\print-bridge` занята другим процессом — две отдельные строки (не блок):

```powershell
git clone --branch cursor/print-bridge-4385 https://github.com/Igor-Lark/Igor.git D:\CURSOR\print-bridge-git
```

```powershell
powershell -ExecutionPolicy Bypass -File "D:\CURSOR\print-bridge-git\локальная\install-autostart.ps1"
```

В автозагрузку Windows пишется `print-watch.ps1` из того клона, откуда ставили.

Скрипт каждые 60 сек: `git fetch --all`, забирает новые `inbox/*.docx` со всех веток `cursor/*`, печатает через Word, помечает как сделанные.

Принтер: очередь Windows по умолчанию. Двустороннюю печать на принтере **выключить**.

---

## Имена файлов

- Анализ: как обычно, `Analiz_RK_…_2026-08-16.docx`
- Не класть в inbox баннеры, CSV, скрины — только Word, который нужно на бумаге.

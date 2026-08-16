# Мост печати

Клон: **`D:\CURSOR\print-bridge`**  
Очередь: **`D:\CURSOR\print-bridge\inbox`**

Если папки клона ещё нет — в PowerShell:

```powershell
irm https://raw.githubusercontent.com/Igor-Lark/Igor/cursor/print-bridge-4385/bootstrap-print-bridge.ps1 | iex
```

Если клон уже есть:

```powershell
powershell -ExecutionPolicy Bypass -File "D:\CURSOR\print-bridge\локальная\install-autostart.ps1"
```

В автозагрузку попадёт:

```
powershell -ExecutionPolicy Bypass -File "D:\CURSOR\print-bridge\локальная\print-watch.ps1"
```

Принтер по умолчанию, печать односторонняя. Подробности: `cursor/print_bridge.md`.

# Мост печати

Облачные рекламные агенты кладут Word в `print-inbox/`.  
Этот ПК печатает их, если запущен `print-watch.ps1`.

```powershell
powershell -ExecutionPolicy Bypass -File "D:\CURSOR\Igor\локальная\print-watch.ps1"
```

Путь поправь, если клон лежит иначе. Принтер по умолчанию, печать односторонняя.
Подробности: `cursor/print_bridge.md`.

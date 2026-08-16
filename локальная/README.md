# Мост печати

Облачные рекламные агенты кладут Word в `print-inbox/`.  
Этот ПК печатает их, если запущен `print-watch.ps1`.

Автозагрузка (один раз на ПК):

```powershell
powershell -ExecutionPolicy Bypass -File "D:\CURSOR\Igor\локальная\install-autostart.ps1"
```

В автозагрузку попадёт:

```
powershell -ExecutionPolicy Bypass -File "D:\CURSOR\Igor\локальная\print-watch.ps1"
```

Принтер по умолчанию, печать односторонняя. Подробности: `cursor/print_bridge.md`.

# Мост печати

Клон: **`D:\CURSOR\print-bridge`**  
Очередь: **`D:\CURSOR\print-bridge\inbox`**

Автозагрузка (один раз на ПК):

```powershell
powershell -ExecutionPolicy Bypass -File "D:\CURSOR\print-bridge\локальная\install-autostart.ps1"
```

В автозагрузку попадёт:

```
powershell -ExecutionPolicy Bypass -File "D:\CURSOR\print-bridge\локальная\print-watch.ps1"
```

Принтер по умолчанию, печать односторонняя. Подробности: `cursor/print_bridge.md`.

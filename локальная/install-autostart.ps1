# Ставит мост печати в автозагрузку Windows.
# Запуск один раз: powershell -ExecutionPolicy Bypass -File "D:\CURSOR\Igor\локальная\install-autostart.ps1"

$ErrorActionPreference = "Stop"
$Watch = "D:\CURSOR\Igor\локальная\print-watch.ps1"
$Cmd = "powershell -ExecutionPolicy Bypass -File `"$Watch`""
$Startup = [Environment]::GetFolderPath("Startup")
$Bat = Join-Path $Startup "boat-print-watch.bat"

if (-not (Test-Path $Watch)) {
    Write-Error "Нет файла $Watch — поправь путь к клону."
}

@"
@echo off
$Cmd
"@ | Set-Content -Path $Bat -Encoding ASCII

Write-Host "Автозагрузка: $Bat"
Write-Host "Команда: $Cmd"

# Запустить мост сейчас, не ждать перезагрузки
$running = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*print-watch.ps1*" }
if (-not $running) {
    Start-Process -FilePath "powershell.exe" -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", $Watch)
    Write-Host "Мост запущен сейчас."
} else {
    Write-Host "Мост уже работает."
}

Write-Host "После входа в Windows печать поднимется сама."

# Ставит мост печати в автозагрузку Windows.
# Клон: D:\CURSOR\print-bridge  Очередь: D:\CURSOR\print-bridge\inbox
# Запуск один раз: powershell -ExecutionPolicy Bypass -File "D:\CURSOR\print-bridge\локальная\install-autostart.ps1"

$ErrorActionPreference = "Stop"
$Watch = "D:\CURSOR\print-bridge\локальная\print-watch.ps1"
$Cmd = "powershell -ExecutionPolicy Bypass -File `"$Watch`""
$Startup = [Environment]::GetFolderPath("Startup")
$Bat = Join-Path $Startup "boat-print-watch.bat"

if (-not (Test-Path $Watch)) {
    Write-Error "Нет файла $Watch — клон должен быть в D:\CURSOR\print-bridge"
}

@"
@echo off
$Cmd
"@ | Set-Content -Path $Bat -Encoding ASCII

Write-Host "Автозагрузка: $Bat"
Write-Host "Команда: $Cmd"
Write-Host "Inbox: D:\CURSOR\print-bridge\inbox"

$running = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*print-watch.ps1*" }
if (-not $running) {
    Start-Process -FilePath "powershell.exe" -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", $Watch)
    Write-Host "Мост запущен сейчас."
} else {
    Write-Host "Мост уже работает."
}

Write-Host "После входа в Windows печать поднимется сама."

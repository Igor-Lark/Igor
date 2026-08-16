# Ставит мост печати в автозагрузку Windows.
# Путь берётся из места, где лежит этот скрипт (print-bridge или print-bridge-git).

$ErrorActionPreference = "Stop"
$Watch = Join-Path $PSScriptRoot "print-watch.ps1"
$Root = Split-Path $PSScriptRoot -Parent
$Inbox = Join-Path $Root "inbox"
$Cmd = "powershell -ExecutionPolicy Bypass -File `"$Watch`""
$Startup = [Environment]::GetFolderPath("Startup")
$Bat = Join-Path $Startup "boat-print-watch.bat"

if (-not (Test-Path $Watch)) {
    Write-Error "Нет файла $Watch"
}

@"
@echo off
$Cmd
"@ | Set-Content -Path $Bat -Encoding ASCII

Write-Host "Автозагрузка: $Bat"
Write-Host "Команда: $Cmd"
Write-Host "Inbox: $Inbox"

$running = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*print-watch.ps1*" }
if (-not $running) {
    Start-Process -FilePath "powershell.exe" -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", $Watch)
    Write-Host "Мост запущен сейчас."
} else {
    Write-Host "Мост уже работает."
}

Write-Host "После входа в Windows печать поднимется сама."

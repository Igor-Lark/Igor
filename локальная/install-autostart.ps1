# ASCII only. Same as repo-root install.ps1
$ErrorActionPreference = "Stop"

$Watch = Join-Path $PSScriptRoot "print-watch.ps1"
$Root = Split-Path $PSScriptRoot -Parent
$Inbox = Join-Path $Root "inbox"
$Cmd = "powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Watch`""
$Startup = [Environment]::GetFolderPath("Startup")
$Bat = Join-Path $Startup "boat-print-watch.bat"

if (-not (Test-Path $Watch)) {
    Write-Error "Missing $Watch"
}

Set-Content -Path $Bat -Value @("@echo off", $Cmd) -Encoding ASCII

Write-Host "Startup: $Bat"
Write-Host "Command: $Cmd"
Write-Host "Inbox: $Inbox"

$running = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*print-watch.ps1*" }
if (-not $running) {
    Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList @("-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", $Watch)
    Write-Host "Watcher started."
} else {
    Write-Host "Watcher already running."
}

# ASCII only. Windows PowerShell 5.1 cannot parse UTF-8 Cyrillic without BOM.
$ErrorActionPreference = "Stop"

$Watch = Get-ChildItem -Path $PSScriptRoot -Recurse -Filter "print-watch.ps1" -File |
    Select-Object -First 1 -ExpandProperty FullName
if (-not $Watch) {
    Write-Error "print-watch.ps1 not found under $PSScriptRoot"
}

$Root = $PSScriptRoot
$Inbox = Join-Path $Root "inbox"
$Cmd = "powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Watch`""
$Startup = [Environment]::GetFolderPath("Startup")
$Bat = Join-Path $Startup "boat-print-watch.bat"

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

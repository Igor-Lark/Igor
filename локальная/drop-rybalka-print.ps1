# ASCII. Drop fishing Word into BOTH inboxes and print now.
$ErrorActionPreference = "Stop"
$Url = "https://github.com/Igor-Lark/Igor/raw/cursor/rybalka-konkurenty-289c/inbox/Konkurenty_gruppovaya_rybalka_Sirius_2026-08-16.docx"
$Name = "Konkurenty_gruppovaya_rybalka_Sirius_2026-08-16.docx"
$Dirs = @(
    "D:\CURSOR\print-bridge-git\inbox",
    "D:\CURSOR\print-bridge\inbox"
)
foreach ($d in $Dirs) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
    $out = Join-Path $d $Name
    Invoke-WebRequest -Uri $Url -OutFile $out
    Write-Host "Saved $out"
}
$print = Join-Path "D:\CURSOR\print-bridge-git\inbox" $Name
if (-not (Test-Path $print)) { $print = Join-Path "D:\CURSOR\print-bridge\inbox" $Name }
Start-Process -FilePath $print -Verb Print
Write-Host "Print sent: $print"

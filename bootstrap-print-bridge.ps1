# Клонирует мост в D:\CURSOR\print-bridge и ставит автозагрузку.
# Вставить целиком в PowerShell (админ не нужен):

$ErrorActionPreference = "Stop"
$Root = "D:\CURSOR\print-bridge"
$RepoUrl = "https://github.com/Igor-Lark/Igor.git"
$Branch = "cursor/print-bridge-4385"

New-Item -ItemType Directory -Force -Path "D:\CURSOR" | Out-Null

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Нужен Git. Поставь https://git-scm.com/download/win и закрой/открой PowerShell."
}

if (-not (Test-Path (Join-Path $Root ".git"))) {
    if (Test-Path $Root) {
        $bak = "$Root.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
        Write-Host "Папка $Root есть, но это не git-клон. Переименовываю в $bak"
        Rename-Item $Root $bak
    }
    Write-Host "Клонирую $Branch → $Root"
    git clone --branch $Branch $RepoUrl $Root
} else {
    Write-Host "Обновляю клон $Root"
    git -C $Root fetch origin
    git -C $Root checkout $Branch
    git -C $Root pull origin $Branch
}

$Watch = Join-Path $Root "локальная\print-watch.ps1"
if (-not (Test-Path $Watch)) {
    Write-Error "После клона нет $Watch"
}

& (Join-Path $Root "локальная\install-autostart.ps1")

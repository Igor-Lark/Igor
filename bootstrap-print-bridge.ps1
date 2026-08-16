# Клонирует мост и ставит автозагрузку. Админ не нужен.
# Если D:\CURSOR\print-bridge занята — клонирует в D:\CURSOR\print-bridge-git.

$ErrorActionPreference = "Stop"
$Preferred = "D:\CURSOR\print-bridge"
$Fallback = "D:\CURSOR\print-bridge-git"
$RepoUrl = "https://github.com/Igor-Lark/Igor.git"
$Branch = "cursor/print-bridge-4385"

New-Item -ItemType Directory -Force -Path "D:\CURSOR" | Out-Null

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Нужен Git. Поставь https://git-scm.com/download/win и закрой/открой PowerShell."
}

function Test-GitClone([string]$Path) {
    Test-Path (Join-Path $Path ".git")
}

function Move-LockedFolder([string]$Path) {
    $bak = "$Path.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Write-Host "Папка $Path есть, но это не git-клон. Пробую переименовать в $bak"
    try {
        Rename-Item -LiteralPath $Path -NewName (Split-Path $bak -Leaf) -ErrorAction Stop
        return $true
    } catch {
        Write-Host "Не вышло переименовать (папка занята другим процессом). Клонирую рядом."
        return $false
    }
}

$Root = $Preferred
if (Test-GitClone $Preferred) {
    $Root = $Preferred
} elseif (Test-GitClone $Fallback) {
    $Root = $Fallback
} else {
    if (Test-Path $Preferred) {
        if (-not (Move-LockedFolder $Preferred)) {
            $Root = $Fallback
        }
    }
    if (Test-Path $Root) {
        if (-not (Test-GitClone $Root)) {
            if (-not (Move-LockedFolder $Root)) {
                Write-Error "И $Preferred, и $Fallback заняты. Закрой Проводник/Cursor на этих папках и запусти снова."
            }
        }
    }
    if (-not (Test-GitClone $Root)) {
        Write-Host "Клонирую $Branch → $Root"
        git clone --branch $Branch $RepoUrl $Root
    }
}

if (Test-GitClone $Root) {
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

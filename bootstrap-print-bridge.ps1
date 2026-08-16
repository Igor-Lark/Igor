# ASCII only. Clone print bridge and install Startup watcher.
# If D:\CURSOR\print-bridge is locked, clone to D:\CURSOR\print-bridge-git.

$ErrorActionPreference = "Stop"
$Preferred = "D:\CURSOR\print-bridge"
$Fallback = "D:\CURSOR\print-bridge-git"
$RepoUrl = "https://github.com/Igor-Lark/Igor.git"
$Branch = "cursor/print-bridge-4385"

New-Item -ItemType Directory -Force -Path "D:\CURSOR" | Out-Null

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is required. Install https://git-scm.com/download/win then reopen PowerShell."
}

function Test-GitClone([string]$Path) {
    Test-Path (Join-Path $Path ".git")
}

function Move-LockedFolder([string]$Path) {
    $bakName = (Split-Path $Path -Leaf) + ".bak-" + (Get-Date -Format yyyyMMdd-HHmmss)
    Write-Host "Folder $Path exists but is not a git clone. Trying rename to $bakName"
    try {
        Rename-Item -LiteralPath $Path -NewName $bakName -ErrorAction Stop
        return $true
    } catch {
        Write-Host "Rename failed (folder in use). Will clone next to it."
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
                Write-Error "Both $Preferred and $Fallback are locked. Close Explorer/Cursor on those folders and retry."
            }
        }
    }
    if (-not (Test-GitClone $Root)) {
        Write-Host "Cloning $Branch -> $Root"
        git clone --no-single-branch --branch $Branch $RepoUrl $Root
    }
}

if (Test-GitClone $Root) {
    Write-Host "Updating clone $Root"
    git -C $Root fetch origin
    git -C $Root checkout $Branch
    git -C $Root pull origin $Branch
}

$Installer = Join-Path $Root "install.ps1"
if (-not (Test-Path $Installer)) {
    $Installer = Get-ChildItem -Path $Root -Recurse -Filter "install-autostart.ps1" -File |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $Installer) {
    Write-Error "install.ps1 not found in $Root"
}

& $Installer

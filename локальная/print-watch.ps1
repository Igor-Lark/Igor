# Мост печати: забирает Word из локальная/print-inbox на всех ветках cursor/*
# и печатает односторонне через Microsoft Word.
# Запуск: powershell -ExecutionPolicy Bypass -File .\print-watch.ps1

$ErrorActionPreference = "Continue"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Split-Path -Parent $Here
$DoneDir = Join-Path $Here "print-done"
$Log = Join-Path $DoneDir "printed.log"
$InboxLocal = Join-Path $Here "print-inbox"

New-Item -ItemType Directory -Force -Path $DoneDir, $InboxLocal | Out-Null
if (-not (Test-Path $Log)) { New-Item -ItemType File -Path $Log | Out-Null }

function Test-Printed($key) {
    return (Select-String -Path $Log -SimpleMatch -Pattern $key -Quiet)
}

function Write-Printed($key) {
    Add-Content -Path $Log -Value $key
}

function Print-Docx($path) {
    $word = $null
    $doc = $null
    try {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = 0
        $doc = $word.Documents.Open($path, $false, $true)
        # Copies=1, без ручного дуплекса
        $missing = [Type]::Missing
        $doc.PrintOut(
            $false, $false, $missing, $missing, $missing, $missing, $missing,
            1, $missing, $missing, $false, $false
        )
        Start-Sleep -Seconds 3
        return $true
    } catch {
        Write-Host "Word COM failed, fallback Verb Print: $_"
        try {
            Start-Process -FilePath $path -Verb Print -Wait
            return $true
        } catch {
            Write-Host "Print failed: $_"
            return $false
        }
    } finally {
        if ($doc) { $doc.Close($false) | Out-Null }
        if ($word) { $word.Quit() | Out-Null }
        if ($doc) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null }
        if ($word) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null }
        [GC]::Collect()
    }
}

function Save-GitBlob($repo, $spec, $outPath) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "git"
    $psi.Arguments = "-C `"$repo`" show `"$spec`""
    $psi.RedirectStandardOutput = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    $fs = [System.IO.File]::Create($outPath)
    try {
        $p.StandardOutput.BaseStream.CopyTo($fs)
    } finally {
        $fs.Close()
        $p.WaitForExit()
    }
    return ((Test-Path $outPath) -and ((Get-Item $outPath).Length -gt 200))
}

function Get-InboxFromGit {
    if (-not (Test-Path (Join-Path $Repo ".git"))) { return }
    git -C $Repo fetch --all --quiet 2>$null
    $branches = git -C $Repo branch -r | ForEach-Object { $_.Trim() } | Where-Object { $_ -like "origin/cursor/*" -and $_ -notlike "*HEAD*" }
    foreach ($b in $branches) {
        $files = git -C $Repo ls-tree -r --name-only $b 2>$null | Where-Object { $_ -match "print-inbox/.+\.docx$" }
        foreach ($rel in $files) {
            $name = Split-Path $rel -Leaf
            $key = "$b|$rel"
            if (Test-Printed $key) { continue }
            $out = Join-Path $InboxLocal $name
            if (-not (Save-GitBlob $Repo "${b}:$rel" $out)) { continue }
            Write-Host "Print $name from $b"
            if (Print-Docx $out) {
                Copy-Item $out (Join-Path $DoneDir $name) -Force
                Write-Printed $key
            }
        }
    }
}

function Get-InboxLocalFolder {
    Get-ChildItem -Path $InboxLocal -Filter *.docx -File -ErrorAction SilentlyContinue | ForEach-Object {
        $key = "local|" + $_.Name + "|" + $_.Length + "|" + $_.LastWriteTimeUtc.ToString("o")
        if (Test-Printed $key) { return }
        Write-Host "Print local $($_.Name)"
        if (Print-Docx $_.FullName) {
            Copy-Item $_.FullName (Join-Path $DoneDir $_.Name) -Force
            Write-Printed $key
        }
    }
}

Write-Host "Мост печати запущен. Репо: $Repo"
Write-Host "Inbox: $InboxLocal  (Ctrl+C — стоп)"
while ($true) {
    Get-InboxFromGit
    Get-InboxLocalFolder
    Start-Sleep -Seconds 60
}

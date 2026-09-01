# Print bridge: pull Word from inbox/ and print one-sided via Word COM.
# ASCII only so Windows PowerShell 5.1 can parse the file.
# Watches BOTH D:\CURSOR\print-bridge and D:\CURSOR\print-bridge-git.

$ErrorActionPreference = "Continue"
$PreferredRepo = "D:\CURSOR\print-bridge"
$FallbackRepo = "D:\CURSOR\print-bridge-git"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Test-Path (Join-Path $FallbackRepo ".git")) {
    $Repo = $FallbackRepo
} elseif (Test-Path (Join-Path $PreferredRepo ".git")) {
    $Repo = $PreferredRepo
} else {
    $Repo = Split-Path -Parent $Here
}

$InboxDirs = @()
foreach ($root in @($FallbackRepo, $PreferredRepo, $Repo)) {
    $ib = Join-Path $root "inbox"
    if ($InboxDirs -notcontains $ib) { $InboxDirs += $ib }
}
$DoneDir = Join-Path $Repo "print-done"
$Log = Join-Path $DoneDir "printed.log"
$InboxLocal = Join-Path $Repo "inbox"

New-Item -ItemType Directory -Force -Path $DoneDir | Out-Null
foreach ($ib in $InboxDirs) { New-Item -ItemType Directory -Force -Path $ib | Out-Null }
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
    git -C $Repo fetch origin "+refs/heads/cursor/*:refs/remotes/origin/cursor/*" 2>> (Join-Path $DoneDir "fetch.log")
    $branches = git -C $Repo branch -r | ForEach-Object { $_.Trim() } | Where-Object { $_ -like "origin/cursor/*" -and $_ -notlike "*HEAD*" }
    foreach ($b in $branches) {
        $files = git -C $Repo ls-tree -r --name-only $b 2>$null | Where-Object { $_ -match "(^inbox/|print-inbox/).+\.docx$" }
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
    foreach ($dir in $InboxDirs) {
        if (-not (Test-Path $dir)) { continue }
        Get-ChildItem -Path $dir -Filter *.docx -File -ErrorAction SilentlyContinue | ForEach-Object {
            $key = "local|" + $_.FullName + "|" + $_.Length + "|" + $_.LastWriteTimeUtc.ToString("o")
            if (Test-Printed $key) { return }
            Write-Host "Print local $($_.FullName)"
            if (Print-Docx $_.FullName) {
                Copy-Item $_.FullName (Join-Path $DoneDir $_.Name) -Force
                Write-Printed $key
            }
        }
    }
}

Write-Host "Print watch running. Repo: $Repo"
Write-Host "Local inboxes:"
foreach ($ib in $InboxDirs) { Write-Host "  $ib" }
Write-Host "Ctrl+C stops until next Windows login."
while ($true) {
    Get-InboxFromGit
    Get-InboxLocalFolder
    Start-Sleep -Seconds 60
}

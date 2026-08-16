# Print bridge: pull Word from inbox/ on ALL origin/cursor/* branches
# and from local inbox folders on both PC clones. Print one-sided via Word COM.
# ASCII only so Windows PowerShell 5.1 can parse the file.

$ErrorActionPreference = "Continue"
$PreferredRepo = "D:\CURSOR\print-bridge"
$FallbackRepo = "D:\CURSOR\print-bridge-git"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptRepo = Split-Path -Parent $Here

function Test-GitRepo([string]$Path) {
    return ($Path -and (Test-Path (Join-Path $Path ".git")))
}

$Repo = $null
if (Test-GitRepo $ScriptRepo) { $Repo = $ScriptRepo }
elseif (Test-GitRepo $FallbackRepo) { $Repo = $FallbackRepo }
elseif (Test-GitRepo $PreferredRepo) { $Repo = $PreferredRepo }
else { $Repo = $ScriptRepo }

$InboxLocal = Join-Path $Repo "inbox"
$DoneDir = Join-Path $Repo "print-done"
$Log = Join-Path $DoneDir "printed.log"

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

function Enable-FetchAllBranches([string]$gitRepo) {
    git -C $gitRepo config --unset-all remote.origin.fetch 2>$null | Out-Null
    git -C $gitRepo config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
}

function Get-InboxFromGit {
    $repos = @($Repo, $PreferredRepo, $FallbackRepo) | Select-Object -Unique
    foreach ($gitRepo in $repos) {
        if (-not (Test-GitRepo $gitRepo)) { continue }
        Enable-FetchAllBranches $gitRepo
        git -C $gitRepo fetch origin --prune --quiet 2>$null
        $branches = git -C $gitRepo branch -r | ForEach-Object { $_.Trim() } |
            Where-Object { $_ -like "origin/cursor/*" -and $_ -notlike "*HEAD*" }
        foreach ($b in $branches) {
            $files = git -C $gitRepo ls-tree -r --name-only $b 2>$null |
                Where-Object { $_ -match "(^inbox/|print-inbox/).+\.docx$" }
            foreach ($rel in $files) {
                $name = Split-Path $rel -Leaf
                $key = "$b|$rel"
                if (Test-Printed $key) { continue }
                $out = Join-Path $InboxLocal $name
                if (-not (Save-GitBlob $gitRepo "${b}:$rel" $out)) { continue }
                Write-Host "Print $name from $b"
                if (Print-Docx $out) {
                    Copy-Item $out (Join-Path $DoneDir $name) -Force
                    Write-Printed $key
                }
            }
        }
    }
}

function Get-LocalInboxDirs {
    $dirs = @(
        $InboxLocal,
        (Join-Path $PreferredRepo "inbox"),
        (Join-Path $FallbackRepo "inbox"),
        (Join-Path $PreferredRepo "print-inbox"),
        (Join-Path $FallbackRepo "print-inbox")
    )
    $legacyName = [string]([char]0x043B) + [string]([char]0x043E) + [string]([char]0x043A) + [string]([char]0x0430) + [string]([char]0x043B) + [string]([char]0x044C) + [string]([char]0x043D) + [string]([char]0x0430) + [string]([char]0x044F)
    $dirs += (Join-Path (Join-Path $PreferredRepo $legacyName) "print-inbox")
    $dirs += (Join-Path (Join-Path $FallbackRepo $legacyName) "print-inbox")
    $dirs += (Join-Path (Join-Path $Repo $legacyName) "print-inbox")
    return $dirs | Select-Object -Unique
}

function Get-InboxLocalFolder {
    foreach ($dir in Get-LocalInboxDirs) {
        if (-not (Test-Path $dir)) { continue }
        Get-ChildItem -Path $dir -Filter *.docx -File -ErrorAction SilentlyContinue | ForEach-Object {
            $key = "local|" + $dir + "|" + $_.Name + "|" + $_.Length + "|" + $_.LastWriteTimeUtc.ToString("o")
            if (Test-Printed $key) { return }
            Write-Host "Print local $($_.Name) from $dir"
            if (Print-Docx $_.FullName) {
                Copy-Item $_.FullName (Join-Path $DoneDir $_.Name) -Force
                Write-Printed $key
            }
        }
    }
}

Write-Host "Print watch running. Repo: $Repo"
Write-Host "Inbox: $InboxLocal  (Ctrl+C to stop)"
Write-Host "Fetches ALL origin/cursor/* branches (not single-branch)."
while ($true) {
    Get-InboxFromGit
    Get-InboxLocalFolder
    Start-Sleep -Seconds 60
}

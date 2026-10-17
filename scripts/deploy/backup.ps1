<#
.SYNOPSIS
    Backup harian SPMI: dump DB (gzip-less .sql) + mirror berkas unggahan. Retensi default 30 hari.
    Dijadwalkan via Task Scheduler "SPMI Backup Harian" (lihat register-tasks.ps1).
#>
[CmdletBinding()]
param(
    [string]$SpmiHome = 'E:\www\spmi-prod',
    [int]$RetentionDays = 30,
    [string]$SecondaryDir = 'D:\backup\spmi'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib-db.ps1')
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$dir = Join-Path $SpmiHome "backups\daily-$ts"
New-Item -ItemType Directory -Force $dir | Out-Null

Invoke-DbDump (Join-Path $dir 'db.sql')

# Mirror unggahan (bertambah terus; disalin inkremental, bukan per-hari).
foreach ($p in 'storage\uploads', 'public-uploads') {
    robocopy (Join-Path $SpmiHome "shared\$p") (Join-Path $SpmiHome "backups\uploads-mirror\$p") /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy $p gagal ($LASTEXITCODE)." }
}

Get-ChildItem (Join-Path $SpmiHome 'backups') -Directory -Filter 'daily-*' |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
    Remove-Item -Recurse -Force

# Salinan kedua di disk fisik lain (D:) agar backup tidak hilang bersama disk aplikasi.
if ($SecondaryDir) {
    robocopy (Join-Path $SpmiHome 'backups') $SecondaryDir /MIR /XD 'test-*' /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy ke $SecondaryDir gagal ($LASTEXITCODE)." }
}
"$(Get-Date -Format o) backup OK $dir" | Add-Content (Join-Path $SpmiHome 'logs\backup.log')

<#
.SYNOPSIS
    Rotasi log harian SPMI dengan retensi 90 hari (ISO/IEC 27002 8.15; UU PDP — minimisasi).
    Dijadwalkan Task Scheduler "\SPMI\SPMI Rotasi Log" (register-tasks.ps1).

    - logs\pm2-out.log, pm2-error.log, watchdog.log, backup.log, privacy-purge.log, data-quality.log
      disalin ke logs\archive\<nama>-<yyyyMMdd>.log lalu dikosongkan (copy-truncate; PM2 tetap menulis
      ke handle yang sama, tidak perlu restart).
    - Arsip & log deploy (deploy-*.log) lebih tua dari -RetentionDays dihapus.
#>
[CmdletBinding()]
param(
    [string]$SpmiHome = 'E:\www\spmi-prod',
    [int]$RetentionDays = 90
)
$ErrorActionPreference = 'Stop'
$logs = Join-Path $SpmiHome 'logs'
$archive = Join-Path $logs 'archive'
New-Item -ItemType Directory -Force $archive | Out-Null
$stamp = (Get-Date).AddDays(-1).ToString('yyyyMMdd')   # isi log = hari sebelumnya

foreach ($name in 'pm2-out', 'pm2-error', 'watchdog', 'backup', 'privacy-purge', 'data-quality') {
    $f = Join-Path $logs "$name.log"
    if (-not (Test-Path $f) -or (Get-Item $f).Length -eq 0) { continue }
    $dest = Join-Path $archive "$name-$stamp.log"
    # Salin isi lalu kosongkan (copy-truncate). FileShare.ReadWrite karena PM2 memegang handle.
    $src = [IO.File]::Open($f, 'Open', 'ReadWrite', 'ReadWrite')
    try {
        $out = [IO.File]::Open($dest, 'Append', 'Write', 'Read')
        try { $src.CopyTo($out) } finally { $out.Dispose() }
        $src.SetLength(0)
    } finally { $src.Dispose() }
}

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem $archive -File | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force
Get-ChildItem $logs -File -Filter 'deploy-*.log' | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force
Get-ChildItem $logs -File -Filter '*.log.1' | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force

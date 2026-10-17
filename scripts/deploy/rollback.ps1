<#
.SYNOPSIS
    Kembalikan produksi SPMI ke rilis sebelumnya (atau rilis tertentu), opsional restore DB.

.PARAMETER To
    Nama folder rilis di <Home>\releases (mis. 20261017-101500). Default: rilis tepat sebelum yang aktif.
.PARAMETER RestoreDb
    Nama folder backup di <Home>\backups yang db.sql-nya dipulihkan. HATI-HATI: data setelah
    backup tersebut akan hilang.

.EXAMPLE
    .\rollback.ps1
    .\rollback.ps1 -To 20261017-101500 -RestoreDb 20261017-113000
#>
[CmdletBinding()]
param(
    [string]$To = '',
    [string]$RestoreDb = '',
    [switch]$Yes,
    [string]$SpmiHome = 'E:\www\spmi-prod'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib-db.ps1')
$Current = Join-Path $SpmiHome 'current'
$releases = Get-ChildItem (Join-Path $SpmiHome 'releases') -Directory | Sort-Object Name
$active = (Get-Item $Current -Force).Target | Select-Object -First 1
$activeName = Split-Path $active -Leaf

if (-not $To) {
    $older = $releases | Where-Object { $_.Name -lt $activeName } | Select-Object -Last 1
    if (-not $older) { throw 'Tidak ada rilis yang lebih lama.' }
    $To = $older.Name
}
$target = Join-Path $SpmiHome "releases\$To"
if (-not (Test-Path (Join-Path $target 'server.js'))) { throw "Rilis tidak valid: $target" }

Write-Host "Aktif  : $activeName"
Write-Host "Tujuan : $To"
if ($RestoreDb) { Write-Host "Restore DB dari backups\$RestoreDb\db.sql" -ForegroundColor Yellow }
if (-not $Yes -and (Read-Host "Lanjutkan rollback? ketik 'ya'") -ne 'ya') { throw 'Dibatalkan.' }

if ($RestoreDb) {
    $dump = Join-Path $SpmiHome "backups\$RestoreDb\db.sql"
    if (-not (Test-Path $dump)) { throw "Tidak ditemukan: $dump" }
    Invoke-DbRestore $dump
}

& cmd /c rmdir "$Current" | Out-Null
& cmd /c mklink /J "$Current" "$target" | Out-Null
$env:SPMI_HOME = $SpmiHome.Replace('\', '/')
pm2 startOrReload (Join-Path $SpmiHome 'ecosystem.config.cjs') --update-env
pm2 save | Out-Null

& (Join-Path $PSScriptRoot 'smoke-test.ps1')
if ($LASTEXITCODE -ne 0) { Write-Host 'Smoke test setelah rollback GAGAL.' -ForegroundColor Red; exit 1 }
Write-Host "Rollback ke $To selesai." -ForegroundColor Green

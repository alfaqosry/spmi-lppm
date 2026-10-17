<#
.SYNOPSIS
    Daftarkan tugas terjadwal produksi SPMI (idempoten). Jalankan sebagai Administrator.
      - "SPMI Backup Harian"  01:30  <Home>\ops\backup.ps1        (DB + unggahan, salinan ke D:)
      - "SPMI Retensi Data"   02:00  <Home>\ops\privacy-purge.ps1 (UU PDP: hapus log kedaluwarsa)
    Skrip ops disalin ke <Home>\ops oleh deploy-production.ps1.
#>
[CmdletBinding()]
param([string]$SpmiHome = 'E:\www\spmi-prod')
$ErrorActionPreference = 'Stop'
$ops = Join-Path $SpmiHome 'ops'
if (-not (Test-Path (Join-Path $ops 'backup.ps1'))) {
    New-Item -ItemType Directory -Force $ops | Out-Null
    Copy-Item (Join-Path $PSScriptRoot '*.ps1') $ops -Force
}
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)

$tasks = @(
    @{ Name = 'SPMI Backup Harian'; Script = 'backup.ps1'; At = '01:30' },
    @{ Name = 'SPMI Retensi Data'; Script = 'privacy-purge.ps1'; At = '02:00' }
)
foreach ($t in $tasks) {
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $ops $t.Script)`" -SpmiHome `"$SpmiHome`""
    $trigger = New-ScheduledTaskTrigger -Daily -At $t.At
    Register-ScheduledTask -TaskName $t.Name -TaskPath '\SPMI\' -Action $action -Trigger $trigger `
        -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "  [OK] \SPMI\$($t.Name) — harian $($t.At)"
}

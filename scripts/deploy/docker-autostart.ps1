<#
.SYNOPSIS
    Pastikan Docker Desktop (dan seluruh kontainer, termasuk spmi-db) hidup setelah server
    reboot TANPA perlu ada yang login, dan dijaga terus oleh watchdog. Jalankan sebagai Administrator.

.DESCRIPTION
    Mendaftarkan dua tugas di folder \SPMI\ (idempoten):
      - "Docker Desktop Autostart" : saat boot (+45 dtk) menjalankan Docker Desktop sebagai Administrator.
      - "SPMI Watchdog"             : saat boot (+3 mnt) lalu setiap 5 menit — ops\watchdog.ps1
                                      (engine Docker -> kontainer spmi-db -> /api/health -> PM2).
    Juga menyalakan setelan Docker Desktop AutoStart.

    Docker Desktop butuh sesi pengguna (profil + WSL2), sehingga tugas berjalan sebagai akun
    Administrator. Dua mode:
      - -Credential (DISARANKAN): "Run whether user is logged on or not" dengan sandi tersimpan
        (terenkripsi oleh Task Scheduler). Paling andal untuk WSL2.
      - tanpa -Credential: logon S4U (tanpa menyimpan sandi). Berjalan tanpa login, tetapi tidak
        punya kredensial jaringan; uji dengan reboot terjadwal.

.EXAMPLE
    .\docker-autostart.ps1 -Credential (Get-Credential Administrator)
    .\docker-autostart.ps1            # mode S4U
#>
[CmdletBinding()]
param(
    [pscredential]$Credential,
    [string]$SpmiHome = 'E:\www\spmi-prod'
)
$ErrorActionPreference = 'Stop'
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'Jalankan PowerShell sebagai Administrator.' }

$ops = Join-Path $SpmiHome 'ops'
New-Item -ItemType Directory -Force $ops | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'watchdog.ps1') $ops -Force

# Setelan Docker Desktop: AutoStart = true (berlaku saat login interaktif).
$settings = Join-Path $env:APPDATA 'Docker\settings-store.json'
if (Test-Path $settings) {
    $j = Get-Content $settings -Raw | ConvertFrom-Json
    if ($j.PSObject.Properties.Name -contains 'AutoStart') { $j.AutoStart = $true } else { $j | Add-Member AutoStart $true }
    [IO.File]::WriteAllText($settings, ($j | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding $false))
    Write-Host '  [OK] Docker Desktop AutoStart = true'
}

$user = "$env:COMPUTERNAME\Administrator"
$set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

function RegisterTask([string]$Name, $Action, $Triggers) {
    if ($Credential) {
        Register-ScheduledTask -TaskPath '\SPMI\' -TaskName $Name -Action $Action -Trigger $Triggers -Settings $set `
            -User $Credential.UserName -Password $Credential.GetNetworkCredential().Password -RunLevel Highest -Force | Out-Null
    } else {
        $pr = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Highest
        Register-ScheduledTask -TaskPath '\SPMI\' -TaskName $Name -Action $Action -Trigger $Triggers -Settings $set -Principal $pr -Force | Out-Null
    }
    Write-Host "  [OK] \SPMI\$Name ($(if ($Credential) { 'sandi tersimpan' } else { 'S4U' }))"
}

# 1) Docker Desktop saat boot.
$boot = New-ScheduledTaskTrigger -AtStartup; $boot.Delay = 'PT45S'
RegisterTask 'Docker Desktop Autostart' (New-ScheduledTaskAction -Execute 'C:\Program Files\Docker\Docker\Docker Desktop.exe') @($boot)

# 2) Watchdog saat boot (+3 mnt) dan setiap 5 menit.
$wdAction = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $ops 'watchdog.ps1')`" -SpmiHome `"$SpmiHome`""
$wdBoot = New-ScheduledTaskTrigger -AtStartup; $wdBoot.Delay = 'PT3M'
$wdRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
# Watchdog berjalan sebagai SYSTEM: tidak terpengaruh lockout/sandi akun Administrator dan
# tetap bisa mengendalikan kontainer & PM2. Bila engine mati, ia memicu tugas Autostart di atas.
$sysPr = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskPath '\SPMI\' -TaskName 'SPMI Watchdog' -Action $wdAction -Trigger @($wdBoot, $wdRepeat) `
    -Settings $set -Principal $sysPr -Force | Out-Null
Write-Host '  [OK] \SPMI\SPMI Watchdog (SYSTEM)'

Write-Host ''
Write-Host 'Selesai. Uji: Start-ScheduledTask -TaskPath \SPMI\ -TaskName "SPMI Watchdog"; cek logs\watchdog.log' -ForegroundColor Green

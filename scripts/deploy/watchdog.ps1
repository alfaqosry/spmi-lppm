<#
.SYNOPSIS
    Watchdog SPMI: pastikan engine Docker, kontainer DB, dan aplikasi (PM2) tetap berjalan.
    Dijalankan Task Scheduler "\SPMI\SPMI Watchdog" saat boot dan setiap 5 menit
    (didaftarkan oleh docker-autostart.ps1).

    Urutan pemulihan:
      1. Engine Docker mati      -> `docker desktop start` (fallback: jalankan Docker Desktop.exe), tunggu siap
      2. Kontainer tidak running -> `docker start <nama>` (restart policy unless-stopped menangani sisanya)
      3. /api/health gagal 2x    -> `pm2 startOrReload ecosystem.config.cjs` (env eksplisit, bukan restart --update-env)
    Semua kejadian dicatat ke <Home>\logs\watchdog.log (dirotasi bila > 5 MB). Saat sehat tidak menulis apa pun.
#>
[CmdletBinding()]
param(
    [string]$SpmiHome = 'E:\www\spmi-prod',
    [string[]]$Containers = @('spmi-db'),
    [int]$EngineWaitSeconds = 300,
    [string]$HealthUrl = 'http://127.0.0.1:3002/api/health'
)
$ErrorActionPreference = 'Continue'
$LogFile = Join-Path $SpmiHome 'logs\watchdog.log'
$DockerExe = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$DesktopExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
if (-not (Test-Path $DockerExe)) { $DockerExe = 'docker' }

function Log([string]$m) {
    if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 5MB) { Move-Item $LogFile "$LogFile.1" -Force }
    "$(Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz') $m" | Add-Content $LogFile -Encoding UTF8
}
function Docker { $out = & $DockerExe @args 2>&1; [pscustomobject]@{ Ok = ($LASTEXITCODE -eq 0); Out = ($out | Out-String).Trim() } }
function EngineUp { (Docker info --format '{{.ServerVersion}}').Ok }
function AppHealthy {
    try { return ((Invoke-WebRequest $HealthUrl -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200) } catch { return $false }
}

# Satu instans saja (tugas boot dan tugas berkala bisa bertumpuk).
$mutex = New-Object Threading.Mutex($false, 'Global\SpmiWatchdog')
if (-not $mutex.WaitOne(0)) { exit 0 }
try {
    # ---------------------------------------------------------------- 1. engine Docker
    if (-not (EngineUp)) {
        Log 'Engine Docker tidak merespons — menjalankan Docker Desktop.'
        if ([Security.Principal.WindowsIdentity]::GetCurrent().IsSystem) {
            # Docker Desktop terpasang per-pengguna (Administrator); jangan dijalankan sebagai SYSTEM.
            # Picu tugas yang berjalan sebagai Administrator.
            try { Start-ScheduledTask -TaskPath '\SPMI\' -TaskName 'Docker Desktop Autostart' -ErrorAction Stop }
            catch { Log "Gagal memicu tugas 'Docker Desktop Autostart': $($_.Exception.Message)" }
        } else {
            $r = Docker desktop start --detach
            if (-not $r.Ok) {
                Log "docker desktop start gagal ($($r.Out)); fallback menjalankan Docker Desktop.exe"
                if (Test-Path $DesktopExe) { Start-Process -FilePath $DesktopExe -WindowStyle Hidden }
            }
        }
        $deadline = (Get-Date).AddSeconds($EngineWaitSeconds)
        while (-not (EngineUp) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 5 }
        if (EngineUp) { Log 'Engine Docker siap.' } else { Log "GAGAL: engine Docker belum siap setelah $EngineWaitSeconds dtk."; exit 1 }
    }

    # ---------------------------------------------------------------- 2. kontainer
    foreach ($c in $Containers) {
        $s = Docker inspect -f '{{.State.Status}}' $c
        if (-not $s.Ok) { Log "Kontainer $c tidak ditemukan: $($s.Out)"; continue }
        if ($s.Out -ne 'running') {
            Log "Kontainer $c berstatus '$($s.Out)' — docker start."
            $r = Docker start $c
            Log "docker start $c -> $(if ($r.Ok) { 'OK' } else { "GAGAL: $($r.Out)" })"
        }
    }

    # ---------------------------------------------------------------- 3. aplikasi
    if (-not (AppHealthy)) {
        Start-Sleep -Seconds 20   # beri waktu DB yang baru hidup / proses yang sedang restart
        if (-not (AppHealthy)) {
            Log 'Aplikasi tidak sehat — pm2 startOrReload spmi.'
            $env:SPMI_HOME = $SpmiHome.Replace('\', '/')
            $env:PM2_HOME = 'C:\pm2'
            $pm2 = 'C:\Users\Administrator\AppData\Roaming\npm\node_modules\pm2\bin\pm2'
            $node = 'C:\Program Files\nodejs\node.exe'
            $out = & $node $pm2 startOrReload (Join-Path $SpmiHome 'ecosystem.config.cjs') 2>&1
            & $node $pm2 save 2>&1 | Out-Null
            Start-Sleep -Seconds 15
            Log "pm2 startOrReload -> $(if (AppHealthy) { 'sehat' } else { 'MASIH TIDAK SEHAT: ' + (($out | Out-String).Trim() -replace '\s+', ' ').Substring(0, [Math]::Min(300, (($out | Out-String).Trim()).Length)) })"
        }
    }
} finally { $mutex.ReleaseMutex() }

<#
.SYNOPSIS
    Penyiapan SEKALI JALAN lingkungan produksi SPMI di server ini (idempoten).

.DESCRIPTION
      1. Struktur direktori  <Home>\{releases,shared,logs,backups,iis,builds}
      2. Rahasia            shared\db.env + shared\.env dibuat dengan nilai acak bila belum ada
                            (berkas yang sudah ada TIDAK ditimpa)
      3. Database           container MySQL 8 "spmi-db" (127.0.0.1:33063) via Docker Compose
      4. IIS                app pool "spmi" (No Managed Code) + site spmi.universitaspahlawan.ac.id
                            (http/https SNI), web.config reverse proxy -> 127.0.0.1:3002,
                            allowedServerVariables HTTP_X_FORWARDED_PROTO
      5. PM2                ecosystem.config.cjs disalin ke <Home>
      6. SSL                sertifikat Let's Encrypt via win-acme (-Ssl), perpanjangan otomatis
                            oleh task "win-acme renew"

    Jalankan dari PowerShell sebagai Administrator, dari root repo.

.EXAMPLE
    .\scripts\deploy\setup-production.ps1
    .\scripts\deploy\setup-production.ps1 -Ssl -Email lpm@universitaspahlawan.ac.id
#>
[CmdletBinding()]
param(
    [string]$SpmiHome = 'E:\www\spmi-prod',
    [string]$HostName = 'spmi.universitaspahlawan.ac.id',
    [string]$SiteName = 'spmi.universitaspahlawan.ac.id',
    [string]$Pool = 'spmi',
    [switch]$Ssl,
    [string]$Email = 'lpm@universitaspahlawan.ac.id',
    [string]$Wacs = 'C:\win-acme\wacs.exe'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$AppCmd = Join-Path $env:windir 'System32\inetsrv\appcmd.exe'

function Step([string]$m) { Write-Host ''; Write-Host "==> $m" -ForegroundColor Cyan }
function NewSecret([int]$bytes = 48) {
    $b = New-Object byte[] $bytes
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    # URL-safe tanpa padding agar aman di DATABASE_URL.
    [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}
function WriteUtf8NoBom([string]$Path, [string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding $false))
}
# Perintah native: stderr tidak dianggap error (PowerShell 5.1); cek exit code.
function Native([scriptblock]$Cmd) {
    $p = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { & $Cmd 2>&1 | ForEach-Object { "    $_" } } finally { $ErrorActionPreference = $p }
}
function ReadEnvFile([string]$Path) {
    $h = @{}
    foreach ($l in Get-Content $Path) {
        if ($l -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.*?)"?\s*$') { $h[$Matches[1]] = $Matches[2] }
    }
    $h
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'Jalankan PowerShell sebagai Administrator.' }

# ---------------------------------------------------------------- 1. direktori
Step '1. Struktur direktori'
foreach ($d in 'releases', 'shared', 'shared\storage\uploads', 'shared\public-uploads\branding', 'logs', 'backups', 'iis', 'builds') {
    New-Item -ItemType Directory -Force (Join-Path $SpmiHome $d) | Out-Null
}
# Batasi ACL folder berisi rahasia/data pribadi (shared, backups, logs): hanya Administrators + SYSTEM.
foreach ($d in 'shared', 'backups', 'logs') {
    & icacls (Join-Path $SpmiHome $d) /inheritance:r /grant:r 'Administrators:(OI)(CI)F' 'SYSTEM:(OI)(CI)F' | Out-Null
}
Write-Host "    $SpmiHome"

# ---------------------------------------------------------------- 2. rahasia
Step '2. Berkas lingkungan'
$dbEnv = Join-Path $SpmiHome 'shared\db.env'
if (-not (Test-Path $dbEnv)) {
    WriteUtf8NoBom $dbEnv (@(
            "MYSQL_ROOT_PASSWORD=$(NewSecret 32)",
            'MYSQL_DATABASE=lpm_spmi',
            'MYSQL_USER=spmi',
            "MYSQL_PASSWORD=$(NewSecret 32)"
        ) -join "`n")
    Write-Host '    shared\db.env dibuat (kata sandi acak).'
} else { Write-Host '    shared\db.env sudah ada — dipertahankan.' }
$db = ReadEnvFile $dbEnv

$appEnv = Join-Path $SpmiHome 'shared\.env'
if (-not (Test-Path $appEnv)) {
    $uploads = (Join-Path $SpmiHome 'shared\storage\uploads').Replace('\', '/')
    WriteUtf8NoBom $appEnv (@(
            '# Produksi SPMI — dibuat oleh setup-production.ps1. JANGAN di-commit.',
            "DATABASE_URL=`"mysql://$($db.MYSQL_USER):$($db.MYSQL_PASSWORD)@127.0.0.1:33063/$($db.MYSQL_DATABASE)`"",
            "AUTH_SECRET=`"$(NewSecret 48)`"",
            'AUTH_COOKIE_NAME="lpm_session"',
            "APP_URL=`"https://$HostName`"",
            'APP_TIMEZONE="Asia/Jakarta"',
            "UPLOAD_DIR=`"$uploads`"",
            '',
            '# SSO UP — boleh dikosongkan; lebih disarankan diisi via menu Pengaturan (Superadmin).',
            'SSO_URL="https://sso-v2.universitaspahlawan.ac.id"',
            'SSO_CLIENT_ID=""',
            'SSO_CLIENT_SECRET=""',
            "SSO_REDIRECT_URI=`"https://$HostName/api/sso/callback`"",
            'SSO_SCOPE="*"',
            'SSO_PROMPT="login"',
            'SSO_ADMIN_EMAILS="lpm@universitaspahlawan.ac.id"',
            'SSO_TRUST_ROLE=""'
        ) -join "`n")
    Write-Host '    shared\.env dibuat (AUTH_SECRET acak). Lengkapi SSO_CLIENT_ID/SECRET.'
} else { Write-Host '    shared\.env sudah ada — dipertahankan.' }

# ---------------------------------------------------------------- 3. database
Step '3. Database (Docker: spmi-db)'
Native { docker compose -p spmi -f (Join-Path $RepoRoot 'deploy\docker-compose.db.yml') --env-file $dbEnv up -d }
if ($LASTEXITCODE -ne 0) { throw 'docker compose up gagal.' }
$ok = $false
for ($i = 0; $i -lt 40; $i++) {
    $s = (Native { docker inspect -f '{{.State.Health.Status}}' spmi-db }).Trim()
    if ($s -eq 'healthy') { $ok = $true; break }
    Start-Sleep -Seconds 3
}
if (-not $ok) { throw 'spmi-db tidak sehat dalam 2 menit.' }
Write-Host '    spmi-db healthy (127.0.0.1:33063).'

# ---------------------------------------------------------------- 4. IIS
Step '4. IIS'
Import-Module WebAdministration
$iisDir = Join-Path $SpmiHome 'iis'
Copy-Item (Join-Path $RepoRoot 'deploy\iis\web.config') (Join-Path $iisDir 'web.config') -Force
Copy-Item (Join-Path $RepoRoot 'deploy\iis\maintenance.html') (Join-Path $iisDir 'maintenance.html') -Force
if (-not (Test-Path "IIS:\AppPools\$Pool")) {
    New-WebAppPool -Name $Pool | Out-Null
    Set-ItemProperty "IIS:\AppPools\$Pool" managedRuntimeVersion ''
    Write-Host "    App pool $Pool dibuat."
}
if (-not (Get-Website -Name $SiteName)) {
    New-Website -Name $SiteName -PhysicalPath $iisDir -ApplicationPool $Pool -HostHeader $HostName -Port 80 | Out-Null
    Write-Host "    Site $SiteName dibuat."
} else {
    Set-ItemProperty "IIS:\Sites\$SiteName" physicalPath $iisDir
}
Native { & $AppCmd set config $SiteName -section:system.webServer/rewrite/allowedServerVariables "/+[name='HTTP_X_FORWARDED_PROTO']" /commit:apphost } | Out-Null
$siteId = (Get-Website -Name $SiteName).Id
Write-Host "    Site ID: $siteId"

# ---------------------------------------------------------------- 5. PM2
Step '5. PM2'
Copy-Item (Join-Path $RepoRoot 'deploy\ecosystem.config.cjs') (Join-Path $SpmiHome 'ecosystem.config.cjs') -Force
Write-Host "    $SpmiHome\ecosystem.config.cjs (app 'spmi' dimulai oleh deploy-production.ps1)."

# ---------------------------------------------------------------- 6. SSL
if ($Ssl) {
    Step '6. SSL (win-acme)'
    if (-not (Test-Path $Wacs)) { throw "win-acme tidak ditemukan: $Wacs" }
    Native { & $Wacs --source iis --siteid $siteId --host $HostName --installation iis --emailaddress $Email --accepttos }
    if ($LASTEXITCODE -ne 0) { throw 'win-acme gagal menerbitkan sertifikat.' }
    Get-WebBinding -Name $SiteName | Format-Table protocol, bindingInformation, sslFlags
} else {
    Write-Host ''
    Write-Host '    Lewati SSL. Jalankan ulang dengan -Ssl setelah situs bisa diakses lewat HTTP.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Selesai. Berikutnya: .\scripts\deploy\deploy-production.ps1' -ForegroundColor Green

<#
.SYNOPSIS
    Smoke test SPMI pasca-deploy. Exit 0 = lulus, 1 = gagal.

.PARAMETER BaseUrl
    Default langsung ke upstream Node (http://127.0.0.1:3002) sehingga bisa dijalankan
    saat IIS masih menampilkan halaman pemeliharaan. Gunakan URL publik untuk cek ujung-ke-ujung.
.PARAMETER HostHeader
    Header Host yang dikirim ke upstream (agar URL kanonik/cookie sesuai domain produksi).

.EXAMPLE
    .\smoke-test.ps1
    .\smoke-test.ps1 -BaseUrl https://spmi.universitaspahlawan.ac.id -HostHeader ''
#>
[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://127.0.0.1:3002',
    [string]$HostHeader = 'spmi.universitaspahlawan.ac.id',
    [int]$Retries = 20,
    [int]$DelaySeconds = 3
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$handler = New-Object System.Net.Http.HttpClientHandler
$handler.AllowAutoRedirect = $false
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds(20)

function Get-Url([string]$path) {
    $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Get, ($BaseUrl.TrimEnd('/') + $path))
    if ($HostHeader) { $req.Headers.Host = $HostHeader; $req.Headers.Add('X-Forwarded-Proto', 'https') }
    $client.SendAsync($req).GetAwaiter().GetResult()
}

# 1) Tunggu server siap (health).
$ready = $false
for ($i = 1; $i -le $Retries; $i++) {
    try {
        $r = Get-Url '/api/health'
        if ([int]$r.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds $DelaySeconds
}
if (-not $ready) { Write-Host '[GAGAL] /api/health tidak merespons 200.' -ForegroundColor Red; exit 1 }

$fail = 0
function Check([string]$name, [bool]$cond, [string]$detail = '') {
    if ($cond) { Write-Host "  [OK]    $name" -ForegroundColor Green }
    else { Write-Host "  [GAGAL] $name $detail" -ForegroundColor Red; $script:fail++ }
}

$h = Get-Url '/api/health'
$body = $h.Content.ReadAsStringAsync().GetAwaiter().GetResult()
Check 'GET /api/health = 200 & db ok' (([int]$h.StatusCode -eq 200) -and ($body -match '"db"\s*:\s*"ok"')) $body

$cases = @(
    @{ Path = '/login'; Codes = @(200) },
    @{ Path = '/'; Codes = @(200, 302, 303, 307, 308) },
    @{ Path = '/dashboard'; Codes = @(302, 303, 307, 308) },   # wajib dialihkan ke login bila tanpa sesi
    @{ Path = '/kebijakan-privasi'; Codes = @(200) },
    @{ Path = '/syarat-ketentuan'; Codes = @(200) },
    @{ Path = '/robots.txt'; Codes = @(200) },
    @{ Path = '/sitemap.xml'; Codes = @(200) },
    @{ Path = '/halaman-yang-tidak-ada-xyz'; Codes = @(404) }
)
foreach ($c in $cases) {
    try {
        $r = Get-Url $c.Path
        Check "GET $($c.Path) = $([int]$r.StatusCode)" ($c.Codes -contains [int]$r.StatusCode) "(harapan: $($c.Codes -join '/'))"
    } catch { Check "GET $($c.Path)" $false $_.Exception.Message }
}

# Header keamanan pada halaman login.
$r = Get-Url '/login'
$hdr = @{}
foreach ($kv in $r.Headers) { $hdr[$kv.Key.ToLower()] = ($kv.Value -join ',') }
foreach ($kv in $r.Content.Headers) { $hdr[$kv.Key.ToLower()] = ($kv.Value -join ',') }
foreach ($name in 'content-security-policy', 'strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy') {
    Check "header $name" ($hdr.ContainsKey($name))
}
# ARR hanya bisa mengosongkan nilai X-Powered-By (header tetap ada tanpa isi) — itu aman.
Check 'x-powered-by tidak membocorkan teknologi' (-not ($hdr.ContainsKey('x-powered-by') -and $hdr['x-powered-by'].Trim()))

if ($fail -gt 0) { Write-Host "Smoke test GAGAL ($fail cek)." -ForegroundColor Red; exit 1 }
Write-Host 'Smoke test LULUS.' -ForegroundColor Green
exit 0

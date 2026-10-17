<#
.SYNOPSIS
    Cek kualitas data harian SPMI (ISO/IEC 25012) pada rilis aktif — hanya-baca.
    Dijadwalkan Task Scheduler "\SPMI\SPMI Kualitas Data". Hasil: logs\data-quality.log
    (ringkasan + baris JSON per eksekusi).
#>
[CmdletBinding()]
param([string]$SpmiHome = 'E:\www\spmi-prod')
$ErrorActionPreference = 'Stop'
foreach ($l in Get-Content (Join-Path $SpmiHome 'shared\.env')) {
    if ($l -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.*?)"?\s*$') { Set-Item "env:$($Matches[1])" $Matches[2] }
}
$env:NODE_ENV = 'production'
$node = Join-Path $SpmiHome 'runtime\node\node.exe'
if (-not (Test-Path $node)) { $node = 'node' }
$cur = Join-Path $SpmiHome 'current'
Push-Location $cur
try {
    $p = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $out = & $node (Join-Path $cur 'tools\data-quality.cjs') 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $p
} finally { Pop-Location }
($out | Out-String).TrimEnd() | Add-Content (Join-Path $SpmiHome 'logs\data-quality.log') -Encoding UTF8
exit $code

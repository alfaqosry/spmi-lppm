<#
.SYNOPSIS
    Jalankan retensi data SPMI (hapus log melewati masa simpan) pada rilis aktif.
    Dijadwalkan harian oleh Task Scheduler "SPMI Retensi Data".
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
    $out = & $node (Join-Path $cur 'tools\privacy-purge.cjs') 2>&1
    $code = $LASTEXITCODE
} finally { Pop-Location }
"$out" | Add-Content (Join-Path $SpmiHome 'logs\privacy-purge.log')
exit $code

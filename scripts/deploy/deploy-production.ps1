<#
.SYNOPSIS
    Deploy SPMI ke PRODUKSI (https://spmi.universitaspahlawan.ac.id) dengan rilis atomik + rollback otomatis.

.DESCRIPTION
    Kode live tidak pernah dibangun di tempat. Urutan:
      a. Preflight   : cek tool, ref target, git worktree bersih di <Home>\builds\<ts>
      b. Gerbang test: npm ci → lint → format:check → typecheck → test (WAJIB lulus, kecuali -SkipTests)
      c. Build       : next build (output standalone) → rakit <Home>\releases\<ts>
                       (standalone + .next\static + public; public\uploads = junction ke shared)
      d. Backup      : mysqldump spmi-db + salinan .env → <Home>\backups\<ts>\ (+ manifest.json)
      e. Maintenance : IIS menyajikan 503 + maintenance.html
      d2. SQL manual : prisma/sql/*.sql tertunda digladikan pada salinan backup (jumlah baris harus identik,
                       db push harus lolos); bila skema sudah sesuai, dicatat sebagai baseline
      f. Migrasi     : SQL manual (bila ada) + prisma db push (tanpa --accept-data-loss: destruktif = gagal)
      g. Aktivasi    : junction <Home>\current → rilis baru, pm2 startOrReload
      h. Smoke test  : scripts\deploy\smoke-test.ps1 ke upstream 127.0.0.1:3002
      i. Gagal?      : rollback otomatis (junction ke rilis sebelumnya + restore DB dari backup d)
      j. Selesai     : maintenance dicabut, cek publik, simpan 5 rilis terakhir

    Log: <Home>\logs\deploy-<ts>.log

.PARAMETER Ref
    Tag/branch/commit (default: HEAD repo). Disarankan tag SemVer, mis. v1.1.0.
.PARAMETER SkipTests
    DARURAT saja (hotfix kritis). Catat alasannya.
.PARAMETER NoAutoRollback
    Bila smoke test gagal, jangan rollback (situs tetap dalam pemeliharaan).
.PARAMETER Yes
    Tanpa konfirmasi interaktif.

.EXAMPLE
    .\scripts\deploy\deploy-production.ps1 -Ref v1.1.0 -Yes
#>
[CmdletBinding()]
param(
    [string]$Ref = 'HEAD',
    [switch]$SkipTests,
    [switch]$NoAutoRollback,
    [switch]$Yes,
    [string]$SpmiHome = 'E:\www\spmi-prod',
    [string]$BaseUrl = 'https://spmi.universitaspahlawan.ac.id',
    [int]$KeepReleases = 5
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib-db.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$Build = Join-Path $SpmiHome "builds\$ts"
$Release = Join-Path $SpmiHome "releases\$ts"
$Current = Join-Path $SpmiHome 'current'
$Shared = Join-Path $SpmiHome 'shared'
$IisDir = Join-Path $SpmiHome 'iis'
$BackupDir = Join-Path $SpmiHome "backups\$ts"
New-Item -ItemType Directory -Force (Join-Path $SpmiHome 'logs') | Out-Null
Start-Transcript -Path (Join-Path $SpmiHome "logs\deploy-$ts.log") -Append | Out-Null

function Step([string]$m) { Write-Host ''; Write-Host "==> $m" -ForegroundColor Cyan }
function Warn([string]$m) { Write-Host "    [PERINGATAN] $m" -ForegroundColor Yellow }
function Exec([string]$Title, [scriptblock]$Cmd) {
    Write-Host "    > $Title" -ForegroundColor DarkGray
    $global:LASTEXITCODE = 0
    $p = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { & $Cmd } finally { $ErrorActionPreference = $p }
    if ($LASTEXITCODE -ne 0) { throw "$Title gagal (exit $LASTEXITCODE)" }
}
function GitQ { $p = $ErrorActionPreference; $ErrorActionPreference = 'Continue'; try { & git -C $RepoRoot @args 2>$null } finally { $ErrorActionPreference = $p } }
function ReadEnvFile([string]$Path) {
    $h = @{}
    foreach ($l in Get-Content $Path) {
        if ($l -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.*?)"?\s*$') { $h[$Matches[1]] = $Matches[2] }
    }
    $h
}
function JunctionTarget([string]$Path) {
    if (-not (Test-Path $Path)) { return '' }
    $i = Get-Item $Path -Force
    if ($i.LinkType -eq 'Junction') { return [string]($i.Target | Select-Object -First 1) }
    return ''
}
function SetJunction([string]$Link, [string]$Target) {
    if (Test-Path $Link) { & cmd /c rmdir "$Link" | Out-Null }   # rmdir pada junction tidak menghapus isi target
    & cmd /c mklink /J "$Link" "$Target" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "mklink /J $Link gagal" }
}
# Berkas konfigurasi IIS/PM2 diambil dari commit yang dideploy (bukan working tree repo dev).
function DeployFile([string]$Rel) {
    $p = Join-Path $Build "deploy\$Rel"
    if (Test-Path $p) { return $p }
    return (Join-Path $RepoRoot "deploy\$Rel")
}
function MaintenanceOn {
    Copy-Item (DeployFile 'iis\maintenance.html') (Join-Path $IisDir 'maintenance.html') -Force
    Copy-Item (DeployFile 'iis\web.maintenance.config') (Join-Path $IisDir 'web.config') -Force
}
function MaintenanceOff { Copy-Item (DeployFile 'iis\web.config') (Join-Path $IisDir 'web.config') -Force }
function Pm2Reload {
    Copy-Item (DeployFile 'ecosystem.config.cjs') (Join-Path $SpmiHome 'ecosystem.config.cjs') -Force
    $env:SPMI_HOME = $SpmiHome.Replace('\', '/')
    Exec 'pm2 startOrReload spmi' { pm2 startOrReload (Join-Path $SpmiHome 'ecosystem.config.cjs') --update-env }
    Exec 'pm2 save' { pm2 save }
}
function RestoreDb([string]$Dump) {
    Write-Host "    > restore DB dari $Dump" -ForegroundColor DarkGray
    Invoke-DbRestore $Dump
}

# Build & migrasi memakai Node LTS khusus SPMI bila tersedia (sama dengan runtime PM2).
$NodeRuntime = Join-Path $SpmiHome 'runtime\node'
if (Test-Path (Join-Path $NodeRuntime 'node.exe')) { $env:Path = "$NodeRuntime;$env:Path" }

$PrevRelease = JunctionTarget $Current
$InMaintenance = $false
$Activated = $false
$DumpFile = ''

try {
    # -------------------------------------------------------------- a. PREFLIGHT
    Step 'a. Preflight'
    foreach ($t in 'git', 'node', 'npm', 'pm2', 'docker') { if (-not (Get-Command $t -ErrorAction SilentlyContinue)) { throw "$t tidak ditemukan di PATH." } }
    foreach ($f in (Join-Path $Shared '.env'), (Join-Path $Shared 'db.env'), (Join-Path $SpmiHome 'ecosystem.config.cjs')) {
        if (-not (Test-Path $f)) { throw "Tidak ditemukan: $f — jalankan setup-production.ps1 dulu." }
    }
    $Commit = GitQ rev-parse --verify --quiet "$Ref^{commit}"
    if (-not $Commit) { throw "Ref '$Ref' tidak ditemukan." }
    $Version = (GitQ describe --tags --always $Commit)
    Write-Host "    Target  : $Ref → $Commit ($Version)"
    Write-Host "    Sebelum : $(if ($PrevRelease) { $PrevRelease } else { '(belum ada rilis)' })"
    if (GitQ status --porcelain) { Warn 'Working tree repo dev tidak bersih — perubahan yang belum di-commit TIDAK ikut dideploy.' }
    if (-not $Yes) {
        if ((Read-Host "Deploy ke PRODUKSI $BaseUrl? ketik 'ya'") -ne 'ya') { throw 'Dibatalkan.' }
    }
    Exec 'git worktree add' { git -C $RepoRoot worktree add --detach $Build $Commit }

    # -------------------------------------------------------------- b. GERBANG TEST
    Step 'b. Gerbang test'
    Push-Location $Build
    $env:NODE_ENV = 'development'   # npm ci memasang devDependencies
    Exec 'npm ci' { npm ci --no-audit --no-fund }
    if ($SkipTests) { Warn 'Gerbang test DILEWATI (-SkipTests).' }
    else {
        $scripts = (Get-Content package.json -Raw | ConvertFrom-Json).scripts
        foreach ($s in 'lint', 'format:check', 'typecheck', 'test') {
            if ($scripts.PSObject.Properties.Name -contains $s) { Exec "npm run $s" { npm run $s } }
            else { Warn "script '$s' tidak ada — dilewati." }
        }
    }

    # -------------------------------------------------------------- c. BUILD
    Step 'c. Build'
    $envVars = ReadEnvFile (Join-Path $Shared '.env')
    foreach ($k in $envVars.Keys) { Set-Item "env:$k" $envVars[$k] }
    $env:NODE_ENV = 'production'; $env:NEXT_TELEMETRY_DISABLED = '1'
    $env:APP_VERSION = $Version; $env:APP_COMMIT = $Commit
    Exec 'next build' { npx next build }
    if (-not (Test-Path '.next\standalone\server.js')) { throw 'Output standalone tidak ditemukan (cek output: "standalone" di next.config.ts).' }

    New-Item -ItemType Directory -Force $Release | Out-Null
    Exec 'salin standalone' { robocopy '.next\standalone' $Release /E /NFL /NDL /NJH /NJS /NP | Out-Null; if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 } }
    Exec 'salin .next\static' { robocopy '.next\static' (Join-Path $Release '.next\static') /E /NFL /NDL /NJH /NJS /NP | Out-Null; if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 } }
    Exec 'salin public' { robocopy 'public' (Join-Path $Release 'public') /E /XD uploads /NFL /NDL /NJH /NJS /NP | Out-Null; if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 } }
    # Pastikan engine Prisma (Windows) ikut walau file tracing melewatkannya.
    Exec 'salin Prisma client' { robocopy 'node_modules\.prisma' (Join-Path $Release 'node_modules\.prisma') /E /NFL /NDL /NJH /NJS /NP | Out-Null; if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 } }
    SetJunction (Join-Path $Release 'public\uploads') (Join-Path $Shared 'public-uploads')
    # Alat operasional: skrip retensi data dibundel (Prisma diambil dari node_modules rilis).
    if (Test-Path 'scripts\data-quality.ts') {
        Exec 'bundel tools\data-quality.cjs' { npx esbuild scripts/data-quality.ts --bundle --platform=node --target=node20 --format=cjs --external:@prisma/client --log-level=warning "--outfile=$(Join-Path $Release 'tools\data-quality.cjs')" }
    }
    Exec 'bundel tools\privacy-purge.cjs' { npx esbuild scripts/privacy-purge.ts --bundle --platform=node --target=node20 --format=cjs --external:@prisma/client --log-level=warning "--outfile=$(Join-Path $Release 'tools\privacy-purge.cjs')" }
    # Skrip ops (backup, purge, smoke test, rollback) disalin ke <Home>\ops agar Task Scheduler tidak bergantung pada repo dev.
    Exec 'salin ops' { robocopy 'scripts\deploy' (Join-Path $SpmiHome 'ops') *.ps1 /NFL /NDL /NJH /NJS /NP | Out-Null; if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 } }
    # Standalone membaca .env di direktori kerja bila ada; nilai PM2 tetap menjadi sumber utama.
    @{ version = $Version; commit = $Commit; ref = $Ref; builtAt = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content (Join-Path $Release 'release.json') -Encoding UTF8
    Pop-Location

    # -------------------------------------------------------------- d. BACKUP
    Step 'd. Backup'
    New-Item -ItemType Directory -Force $BackupDir | Out-Null
    $DumpFile = Join-Path $BackupDir 'db.sql'
    Write-Host '    > mysqldump' -ForegroundColor DarkGray
    Invoke-DbDump $DumpFile
    Copy-Item (Join-Path $Shared '.env') (Join-Path $BackupDir '.env')
    @{ timestamp = $ts; previousRelease = $PrevRelease; newRelease = $Release; commit = $Commit; version = $Version } | ConvertTo-Json | Set-Content (Join-Path $BackupDir 'manifest.json') -Encoding UTF8
    Write-Host "    $BackupDir ($([math]::Round((Get-Item $DumpFile).Length / 1KB)) KB)"

    # -------------------------------------------------------------- d2. MIGRASI SQL MANUAL: GLADI
    # Berkas prisma/sql/*.sql (perubahan skema yang tidak bisa ditangani `prisma db push`)
    # WAJIB digladikan pada salinan backup langkah d sebelum menyentuh produksi:
    # jumlah baris semua tabel harus identik dan `prisma db push` sesudahnya harus lolos.
    # Catatan berkas yang sudah diterapkan: <Home>\shared\sql-migrations.json.
    Step 'd2. Migrasi SQL manual (prisma/sql) — gladi pada salinan'
    $SqlLog = Join-Path $Shared 'sql-migrations.json'
    $RowScript = Join-Path $Build 'deploy\dbowcounts.sh'
    $appliedSql = @{}
    if (Test-Path $SqlLog) { (Get-Content $SqlLog -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $appliedSql[$_.Name] = $_.Value } }
    $PendingSql = @(Get-ChildItem (Join-Path $Build 'prisma\sql') -Filter '*.sql' -ErrorAction SilentlyContinue | Sort-Object Name | Where-Object { -not $appliedSql.ContainsKey($_.Name) })
    $SqlMode = 'none'
    if ($PendingSql.Count -eq 0) { Write-Host '    Tidak ada migrasi SQL tertunda.' }
    else {
        Write-Host "    Tertunda: $(($PendingSql | ForEach-Object Name) -join ', ')"
        Push-Location $Build
        $p = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --exit-code *> $null
        $diffCode = $LASTEXITCODE; $ErrorActionPreference = $p
        Pop-Location
        if ($diffCode -eq 0) {
            $SqlMode = 'baseline'
            Write-Host '    Skema DB sudah sesuai schema.prisma — berkas dicatat sebagai baseline (tidak dijalankan).'
        } elseif ($diffCode -ne 2) { throw "prisma migrate diff gagal (exit $diffCode)." }
        else {
            $SqlMode = 'applied'
            $dbEnv = ReadEnvFile (Join-Path $Shared 'db.env')
            $gladi = 'spmi_gladi'
            $prodUrl = $env:DATABASE_URL
            New-DbCopy $DumpFile $gladi
            try {
                $rowsBefore = Get-DbRowCounts $gladi $RowScript
                foreach ($f in $PendingSql) { Write-Host "    > gladi $($f.Name)"; Invoke-DbRestore $f.FullName $gladi }
                $env:DATABASE_URL = "mysql://root:$($dbEnv.MYSQL_ROOT_PASSWORD)@127.0.0.1:33063/$gladi"
                Push-Location $Build
                try { Exec 'gladi: prisma db push' { npx prisma db push --skip-generate } } finally { Pop-Location }
                $rowsAfter = Get-DbRowCounts $gladi $RowScript
                $lost = @($rowsBefore | Where-Object { $rowsAfter -notcontains $_ })
                if ($lost.Count -gt 0) { throw "Gladi GAGAL — jumlah baris berubah: $($lost -join '; ')" }
                Write-Host "    Gladi lulus: $($rowsBefore.Count) tabel, jumlah baris identik."
            } finally {
                $env:DATABASE_URL = $prodUrl
                Remove-DbCopy $gladi
            }
        }
    }

    # -------------------------------------------------------------- e. MAINTENANCE
    Step 'e. Mode pemeliharaan (IIS 503)'
    MaintenanceOn; $InMaintenance = $true

    # -------------------------------------------------------------- f. MIGRASI
    Step 'f. Migrasi skema'
    if ($SqlMode -eq 'applied') {
        $prodDb = (ReadEnvFile (Join-Path $Shared 'db.env')).MYSQL_DATABASE
        $rowsBefore = Get-DbRowCounts $prodDb $RowScript
        foreach ($f in $PendingSql) { Write-Host "    > SQL $($f.Name)"; Invoke-DbRestore $f.FullName }
        $rowsAfter = Get-DbRowCounts $prodDb $RowScript
        $lost = @($rowsBefore | Where-Object { $rowsAfter -notcontains $_ })
        if ($lost.Count -gt 0) { throw "Jumlah baris produksi berubah setelah SQL: $($lost -join '; ')" }
        Write-Host "    SQL manual diterapkan; jumlah baris $($rowsBefore.Count) tabel identik."
    }
    Push-Location $Build
    Exec 'prisma db push' { npx prisma db push --skip-generate }
    Pop-Location

    # -------------------------------------------------------------- g. AKTIVASI
    Step 'g. Aktivasi rilis'
    SetJunction $Current $Release; $Activated = $true
    Pm2Reload

    # -------------------------------------------------------------- h. SMOKE TEST
    Step 'h. Smoke test (upstream)'
    & (Join-Path $PSScriptRoot 'smoke-test.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Smoke test gagal.' }

    # -------------------------------------------------------------- j. SELESAI
    # Catat migrasi SQL hanya setelah rilis terbukti sehat (rollback = tidak dicatat).
    if ($SqlMode -ne 'none') {
        foreach ($f in $PendingSql) {
            $appliedSql[$f.Name] = [ordered]@{ sha256 = (Get-FileHash $f.FullName -Algorithm SHA256).Hash.ToLower(); mode = $SqlMode; appliedAt = (Get-Date).ToString('o'); version = $Version }
        }
        [IO.File]::WriteAllText($SqlLog, ([pscustomobject]$appliedSql | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding $false))
        Write-Host "    Migrasi SQL dicatat ($SqlMode): $(($PendingSql | ForEach-Object Name) -join ', ')"
    }

    Step 'j. Cabut pemeliharaan'
    MaintenanceOff; $InMaintenance = $false
    & (Join-Path $PSScriptRoot 'smoke-test.ps1') -BaseUrl $BaseUrl -HostHeader '' -Retries 3
    if ($LASTEXITCODE -ne 0) { Warn 'Cek publik via Cloudflare gagal — upstream sehat; periksa IIS/SSL/Cloudflare.' }

    Get-ChildItem (Join-Path $SpmiHome 'releases') -Directory | Sort-Object Name -Descending | Select-Object -Skip $KeepReleases | ForEach-Object {
        $u = Join-Path $_.FullName 'public\uploads'
        if (Test-Path $u) { & cmd /c rmdir "$u" | Out-Null }   # lepas junction dulu agar uploads aman
        Remove-Item $_.FullName -Recurse -Force
    }
    Write-Host ''
    Write-Host "DEPLOY BERHASIL: $Version → $BaseUrl" -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host "DEPLOY GAGAL: $($_.Exception.Message)" -ForegroundColor Red
    if ($InMaintenance -and -not $NoAutoRollback) {
        Step 'i. Rollback otomatis'
        # Setiap langkah berdiri sendiri: kegagalan satu langkah tidak menghentikan langkah lain.
        $rbOk = $true
        try { if ($DumpFile -and (Test-Path $DumpFile)) { RestoreDb $DumpFile } }
        catch { $rbOk = $false; Write-Host "    Restore DB GAGAL: $($_.Exception.Message)" -ForegroundColor Red }
        try {
            if ($Activated -and $PrevRelease) { SetJunction $Current $PrevRelease; Pm2Reload }
            elseif ($Activated) { Warn 'Tidak ada rilis sebelumnya; pm2 spmi dihentikan.'; $p = $ErrorActionPreference; $ErrorActionPreference = 'Continue'; pm2 stop spmi 2>&1 | Out-Null; $ErrorActionPreference = $p }
        } catch { $rbOk = $false; Write-Host "    Aktivasi rilis sebelumnya GAGAL: $($_.Exception.Message)" -ForegroundColor Red }
        # Pemeliharaan hanya dicabut bila rilis yang aktif terbukti sehat.
        $healthy = $false
        if ($PrevRelease) { & (Join-Path $PSScriptRoot 'smoke-test.ps1') -Retries 15; $healthy = ($LASTEXITCODE -eq 0) }
        if ($healthy) {
            MaintenanceOff
            Write-Host "Rollback selesai — rilis sebelumnya aktif$(if (-not $rbOk) { ' (DENGAN PERINGATAN, periksa log)' })." -ForegroundColor Yellow
        } else { Write-Host 'ROLLBACK BELUM PULIH: situs tetap dalam mode pemeliharaan — tangani manual (lihat docs/04-DEPLOYMENT-IIS.md).' -ForegroundColor Red }
    } elseif ($InMaintenance) { Warn '-NoAutoRollback: situs tetap dalam mode pemeliharaan.' }
    if (Test-Path $Release) {
        if (-not $Activated -or $PrevRelease) {
            $u = Join-Path $Release 'public\uploads'; if (Test-Path $u) { & cmd /c rmdir "$u" | Out-Null }
        }
    }
    $global:LASTEXITCODE = 1
}
finally {
    Set-Location $RepoRoot
    if (Test-Path $Build) { GitQ worktree remove --force $Build | Out-Null; if (Test-Path $Build) { Remove-Item $Build -Recurse -Force -ErrorAction SilentlyContinue } }
    Stop-Transcript | Out-Null
}
exit $LASTEXITCODE

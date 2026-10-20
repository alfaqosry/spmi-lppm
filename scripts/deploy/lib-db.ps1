# Helper dump/restore MySQL kontainer spmi-db. Di-dot-source oleh skrip deploy/backup/rollback.
# Kredensial dibaca dari env DI DALAM kontainer (MYSQL_ROOT_PASSWORD/MYSQL_DATABASE), sehingga
# tidak pernah muncul di baris perintah host. Dump/restore memakai berkas sementara di kontainer
# + docker cp (menghindari redirect cmd.exe & konversi encoding PowerShell 5.1).

function Invoke-SpmiDocker([string[]]$DockerArgs) {
    $p = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & docker @DockerArgs 2>&1 } finally { $ErrorActionPreference = $p }
    if ($LASTEXITCODE -ne 0) { throw "docker $($DockerArgs[0..1] -join ' ') gagal: $(($out | Out-String).Trim())" }
}

function Invoke-DbDump([string]$OutFile, [string]$Database = '') {
    $db = if ($Database) { $Database } else { '$MYSQL_DATABASE' }
    Invoke-SpmiDocker @('exec', 'spmi-db', 'sh', '-c',
        "MYSQL_PWD=`$MYSQL_ROOT_PASSWORD mysqldump -uroot --single-transaction --routines --triggers --default-character-set=utf8mb4 $db > /tmp/spmi-dump.sql")
    try { Invoke-SpmiDocker @('cp', 'spmi-db:/tmp/spmi-dump.sql', $OutFile) }
    finally { Invoke-SpmiDocker @('exec', 'spmi-db', 'rm', '-f', '/tmp/spmi-dump.sql') }
    if ((Get-Item $OutFile).Length -lt 100) { throw "Dump DB kosong: $OutFile" }
}

function Invoke-DbRestore([string]$InFile, [string]$Database = '') {
    $db = if ($Database) { $Database } else { '$MYSQL_DATABASE' }
    Invoke-SpmiDocker @('cp', $InFile, 'spmi-db:/tmp/spmi-restore.sql')
    try {
        Invoke-SpmiDocker @('exec', 'spmi-db', 'sh', '-c',
            "MYSQL_PWD=`$MYSQL_ROOT_PASSWORD mysql -uroot --default-character-set=utf8mb4 $db < /tmp/spmi-restore.sql")
    } finally { Invoke-SpmiDocker @('exec', 'spmi-db', 'rm', '-f', '/tmp/spmi-restore.sql') }
}

# Jalankan berkas SQL pada database tertentu (default $MYSQL_DATABASE) dan kembalikan baris hasil (-N).
function Invoke-DbSqlFile([string]$SqlFile, [string]$Database = '') {
    $db = if ($Database) { $Database } else { '$MYSQL_DATABASE' }
    Invoke-SpmiDocker @('cp', $SqlFile, 'spmi-db:/tmp/spmi-query.sql')
    $p = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & docker exec spmi-db sh -c "MYSQL_PWD=`$MYSQL_ROOT_PASSWORD mysql -uroot -N --default-character-set=utf8mb4 $db < /tmp/spmi-query.sql" 2>&1 }
    finally { $ErrorActionPreference = $p }
    $code = $LASTEXITCODE
    Invoke-SpmiDocker @('exec', 'spmi-db', 'rm', '-f', '/tmp/spmi-query.sql')
    $lines = @($out | ForEach-Object { "$_" } | Where-Object { $_ -notmatch 'Using a password on the command line' })
    if ($code -ne 0) { throw "SQL gagal: $($lines -join ' ')" }
    return $lines
}

# Jalankan satu pernyataan SQL (ditulis ke berkas sementara agar aman dari quoting PowerShell 5.1).
function Invoke-DbSql([string]$Sql, [string]$Database = '') {
    $tmp = [IO.Path]::GetTempFileName()
    try {
        [IO.File]::WriteAllText($tmp, $Sql, (New-Object Text.UTF8Encoding $false))
        return Invoke-DbSqlFile $tmp $Database
    } finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
}

# Jumlah baris pasti per tabel ("tabel jumlah") — deploy/db/rowcounts.sh dijalankan di kontainer.
function Get-DbRowCounts([string]$Database, [string]$ScriptPath) {
    Invoke-SpmiDocker @('cp', $ScriptPath, 'spmi-db:/tmp/spmi-rowcounts.sh')
    $p = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & docker exec spmi-db sh /tmp/spmi-rowcounts.sh $Database 2>&1 } finally { $ErrorActionPreference = $p }
    Invoke-SpmiDocker @('exec', 'spmi-db', 'rm', '-f', '/tmp/spmi-rowcounts.sh')
    return @($out | ForEach-Object { "$_" } | Where-Object { $_ -match '^\S+ \d+$' })
}

# Buat ulang database salinan dari berkas dump (untuk gladi migrasi).
function New-DbCopy([string]$Dump, [string]$Name) {
    if ($Name -notmatch '^spmi_[a-z0-9_]+$' -or $Name -eq 'lpm_spmi') { throw "Nama DB salinan tidak sah: $Name" }
    Invoke-DbSql "DROP DATABASE IF EXISTS ``$Name``; CREATE DATABASE ``$Name`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 'mysql' | Out-Null
    Invoke-DbRestore $Dump $Name
}

function Remove-DbCopy([string]$Name) {
    if ($Name -notmatch '^spmi_[a-z0-9_]+$' -or $Name -eq 'lpm_spmi') { throw "Nama DB salinan tidak sah: $Name" }
    Invoke-DbSql "DROP DATABASE IF EXISTS ``$Name``;" 'mysql' | Out-Null
}

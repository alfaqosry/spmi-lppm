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

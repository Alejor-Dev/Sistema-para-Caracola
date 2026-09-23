[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory)]
  [string]$DataDirectory
)

$ErrorActionPreference = 'Stop'
$resolvedData = (Resolve-Path -LiteralPath $DataDirectory).Path
$configPath = Join-Path $resolvedData 'postgresql.conf'
$hbaPath = Join-Path $resolvedData 'pg_hba.conf'

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf) -or -not (Test-Path -LiteralPath $hbaPath -PathType Leaf)) {
  throw "El directorio no contiene un clúster PostgreSQL válido: $resolvedData"
}

$memoryGb = [math]::Floor((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
if ($memoryGb -lt 4) { throw 'Se requieren al menos 4 GB de RAM para ejecutar el CRM de forma segura.' }

if ($memoryGb -lt 8) {
  $sharedBuffers = '512MB'; $effectiveCache = '1536MB'; $workMem = '4MB'; $maintenance = '128MB'; $connections = 20
} elseif ($memoryGb -lt 16) {
  $sharedBuffers = '1GB'; $effectiveCache = '4GB'; $workMem = '8MB'; $maintenance = '256MB'; $connections = 30
} else {
  $sharedBuffers = '2GB'; $effectiveCache = '8GB'; $workMem = '12MB'; $maintenance = '512MB'; $connections = 40
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item -LiteralPath $configPath -Destination "$configPath.$timestamp.bak"
Copy-Item -LiteralPath $hbaPath -Destination "$hbaPath.$timestamp.bak"

$managedConfig = @"

# BEGIN CRM-LOCALDEROPA MANAGED SETTINGS
listen_addresses = '127.0.0.1'
password_encryption = 'scram-sha-256'
shared_buffers = '$sharedBuffers'
effective_cache_size = '$effectiveCache'
work_mem = '$workMem'
maintenance_work_mem = '$maintenance'
max_connections = $connections
wal_compression = on
checkpoint_timeout = '15min'
min_wal_size = '512MB'
max_wal_size = '2GB'
default_statistics_target = 200
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = off
log_disconnections = off
# END CRM-LOCALDEROPA MANAGED SETTINGS
"@

$current = Get-Content -Raw -LiteralPath $configPath
$current = [regex]::Replace($current, '(?s)\r?\n# BEGIN CRM-LOCALDEROPA MANAGED SETTINGS.*?# END CRM-LOCALDEROPA MANAGED SETTINGS\r?\n?', '')

if ($PSCmdlet.ShouldProcess($configPath, 'Aplicar configuración optimizada del CRM')) {
  $utf8 = New-Object Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($configPath, ($current.TrimEnd() + $managedConfig), $utf8)
  $hba = @(
    '# Managed by Caracola. PostgreSQL is local-only.'
    'local   all             all                                     scram-sha-256'
    'host    all             all             127.0.0.1/32            scram-sha-256'
    'host    all             all             ::1/128                 scram-sha-256'
  ) -join [Environment]::NewLine
  [IO.File]::WriteAllText($hbaPath, ($hba + [Environment]::NewLine), $utf8)
}

Write-Host "Perfil aplicado para $memoryGb GB de RAM. Reiniciá el servicio PostgreSQL para activar los cambios." -ForegroundColor Green

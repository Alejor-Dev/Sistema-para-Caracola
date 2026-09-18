[CmdletBinding()]
param(
  [string]$PsqlPath,
  [string]$HostName = '127.0.0.1',
  [int]$Port = 5432,
  [Security.SecureString]$AdminPassword,
  [Security.SecureString]$AppPassword
)

$ErrorActionPreference = 'Stop'

if (-not $PsqlPath) {
  $installRoot = 'C:\Program Files\PostgreSQL'
  $candidate = Get-ChildItem -LiteralPath $installRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\d+$' } |
    Sort-Object { [int]$_.Name } -Descending |
    ForEach-Object { Join-Path $_.FullName 'bin\psql.exe' } |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Select-Object -First 1
  $PsqlPath = $candidate
}

if (-not $PsqlPath -or -not (Test-Path -LiteralPath $PsqlPath -PathType Leaf)) {
  throw "No se encontró psql. Instalá PostgreSQL x64 o indicá -PsqlPath."
}

Import-Module (Join-Path $PSScriptRoot '..\common\Crm.Common.psm1') -Force

$interactive = -not $AdminPassword -and -not $AppPassword

if (-not $AdminPassword) {
  if ($interactive) {
    $AdminPassword = Read-Host 'Contraseña del usuario postgres' -AsSecureString
  } else {
    throw 'Se requiere -AdminPassword en modo no interactivo.'
  }
}

if (-not $AppPassword) {
  if ($interactive) {
    $AppPassword = Read-Host 'Nueva contraseña para el rol crm_app' -AsSecureString
  } else {
    throw 'Se requiere -AppPassword en modo no interactivo.'
  }
}

$adminPlain = Convert-CrmSecureStringToPlain $AdminPassword
$appPlain = Convert-CrmSecureStringToPlain $AppPassword

try {
  $env:PGPASSWORD = $adminPlain
  $template = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'bootstrap.sql')
  $escapedAppPassword = $appPlain.Replace("'", "''")
  $sql = $template.Replace('__CRM_APP_PASSWORD__', $escapedAppPassword)
  $sql | & $PsqlPath --host=$HostName --port=$Port --username=postgres --dbname=postgres --set=ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar la base del CRM.' }
  Write-Host 'Base crm_localderopa y rol crm_app preparados correctamente.' -ForegroundColor Green
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $adminPlain = $null
  $appPlain = $null
  $escapedAppPassword = $null
  $sql = $null
}
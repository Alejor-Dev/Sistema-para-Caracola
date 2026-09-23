#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$InstallerPath,
  [Parameter(Mandatory)][ValidatePattern('^[0-9a-fA-F]{64}$')][string]$ExpectedSha256,
  [Security.SecureString]$SuperPassword,
  [string]$ServiceName = 'postgresql-x64-17-caracola',
  [int]$ServerPort = 5433,
  [string]$Prefix = 'C:\Program Files\PostgreSQL\17-Caracola',
  [string]$DataRoot = 'C:\ProgramData\Caracola',
  [int]$TimeoutSeconds = 600
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\common\Crm.Common.psm1') -Force
Assert-CrmAdministrator

if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
  Write-Host "PostgreSQL ya está instalado (servicio $ServiceName). Se omite la instalación." -ForegroundColor Yellow
  return
}

if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
  throw "No se encontró el instalador de PostgreSQL en '$InstallerPath'."
}

$signature = Get-AuthenticodeSignature -LiteralPath $InstallerPath
if ($signature.Status -ne 'Valid') {
  throw "El instalador de PostgreSQL no tiene una firma Authenticode válida (estado: $($signature.Status)). " +
    'No se ejecuta un binario de terceros sin firma confiable.'
}

$actualHash = (Get-FileHash -LiteralPath $InstallerPath -Algorithm SHA256).Hash
if ($actualHash -ine $ExpectedSha256) {
  throw "SHA-256 del instalador de PostgreSQL no coincide. Esperado $ExpectedSha256, obtenido $actualHash."
}

if (-not $SuperPassword -or $SuperPassword.Length -eq 0) {
  $SuperPassword = New-CrmRandomSecret -Suffix '-Pg!'
}

$superPlain = $null
$dataDirectory = Join-Path $DataRoot 'PostgreSQL\data'
$arguments = @('--mode unattended')
$arguments += '--unattendedmodeui none'
$arguments += '--enable-components server,commandlinetools'
$arguments += '--superaccount postgres'
$superPlain = Convert-CrmSecureStringToPlain $SuperPassword
$arguments += "--superpassword $superPlain"
$arguments += '--serviceaccount caracola_pg'
$arguments += "--servicepassword $superPlain"
$arguments += "--serverport $ServerPort"
$arguments += "--servicename $ServiceName"
$arguments += "--prefix `"$Prefix`""
$arguments += "--datadir `"$dataDirectory`""
$arguments += '--create_shortcuts 0'
$arguments += '--install_runtimes 1'
$arguments += "--debugtrace `"$env:TEMP\postgres-install.log`""
$argumentLine = $arguments -join ' '

$superPlain = $null
$process = Start-Process -FilePath $InstallerPath -ArgumentList $argumentLine -Wait -PassThru -NoNewWindow
if ($process.ExitCode -ne 0) {
  throw "La instalación silenciosa de PostgreSQL finalizó con código $($process.ExitCode). " +
    'Verificá el log de depuración en $env:TEMP\postgres-install.log'
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$service = $null
while ((Get-Date) -lt $deadline) {
  $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($service) { break }
  Start-Sleep -Seconds 3
}
if (-not $service) {
  throw "El servicio $ServiceName no apareció tras la instalación de PostgreSQL."
}

$psql = Join-Path $Prefix 'bin\psql.exe'
if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) {
  throw "No se encontró psql en '$psql' tras la instalación."
}

$secretPath = Join-Path $DataRoot 'secrets\postgres-super.dpapi'
Protect-CrmSecret -Secret $SuperPassword -Path $secretPath
& icacls.exe $secretPath /inheritance:r /grant:r 'SYSTEM:F' 'Administrators:F' | Out-Null

Write-Host "PostgreSQL $ServiceName instalado en $Prefix." -ForegroundColor Green

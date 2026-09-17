#Requires -RunAsAdministrator
[CmdletBinding(SupportsShouldProcess, ConfirmImpact='High')]
param(
  [string]$ConfigPath = 'C:\ProgramData\Caracola\config\production.json',
  [string]$Snapshot = 'latest',
  [string]$TargetDatabase,
  [switch]$Execute
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\common\Crm.Common.psm1') -Force
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if (-not $TargetDatabase) { $TargetDatabase = "$($config.database.name)_restore_$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))" }
if ($TargetDatabase -eq $config.database.name) { throw 'La restauración nunca puede sobrescribir la base activa.' }
if ($TargetDatabase -notmatch '^[a-zA-Z][a-zA-Z0-9_]{2,62}$') { throw 'El nombre de la base destino no es válido.' }

$plan = [ordered]@{ snapshot=$Snapshot; sourceRepository=$config.backup.repository; activeDatabase=$config.database.name; targetDatabase=$TargetDatabase; overwritesActive=$false }
if (-not $Execute) { $plan | ConvertTo-Json; return }

$restic = Get-CrmExecutable -ConfiguredPath $config.backup.resticPath -Name 'restic'
$pgRestore = Get-CrmExecutable -ConfiguredPath $config.backup.pgRestorePath -Name 'pg_restore'
$createdb = Get-CrmExecutable -ConfiguredPath $config.backup.createdbPath -Name 'createdb'
$tempRoot = Join-Path $config.dataRoot ("restore-staging\" + [Guid]::NewGuid().ToString('N'))
$secretFile = Join-Path $tempRoot 'restic-password.tmp'
$dbPassword = $null

if (-not $PSCmdlet.ShouldProcess("base nueva $TargetDatabase", "Restaurar snapshot $Snapshot")) { return }
try {
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
  Unprotect-CrmSecret -Path $config.backup.passwordSecret | Set-Content -LiteralPath $secretFile -NoNewline -Encoding UTF8
  $resticEnvironment = @{ RESTIC_REPOSITORY=$config.backup.repository; RESTIC_PASSWORD_FILE=$secretFile }
  [void](Invoke-CrmProcess -FilePath $restic -ArgumentList @('check') -Environment $resticEnvironment)
  [void](Invoke-CrmProcess -FilePath $restic -ArgumentList @('restore',$Snapshot,'--target',$tempRoot) -Environment $resticEnvironment)
  $manifestPath = Get-ChildItem -LiteralPath $tempRoot -Filter manifest.json -Recurse | Select-Object -First 1 -ExpandProperty FullName
  if (-not $manifestPath) { throw 'El snapshot no contiene manifest.json.' }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $dumpPath = Join-Path (Split-Path -Parent $manifestPath) $manifest.dumpFile
  [void](Test-CrmFileHash -Path $dumpPath -ExpectedSha256 $manifest.dumpSha256)
  $dbPassword = Unprotect-CrmSecret -Path $config.database.passwordSecret
  $dbEnvironment = @{ PGPASSWORD=$dbPassword }
  [void](Invoke-CrmProcess -FilePath $createdb -ArgumentList @("--host=$($config.database.host)","--port=$($config.database.port)","--username=$($config.database.user)",$TargetDatabase) -Environment $dbEnvironment)
  [void](Invoke-CrmProcess -FilePath $pgRestore -ArgumentList @('--no-owner','--no-privileges','--exit-on-error',"--host=$($config.database.host)","--port=$($config.database.port)","--username=$($config.database.user)","--dbname=$TargetDatabase",$dumpPath) -Environment $dbEnvironment)
  [ordered]@{ status='restored'; targetDatabase=$TargetDatabase; activated=$false; manifest=$manifestPath; completedAt=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json
} finally {
  $dbPassword = $null
  if (Test-Path -LiteralPath $secretFile) { Remove-Item -LiteralPath $secretFile -Force }
  if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}

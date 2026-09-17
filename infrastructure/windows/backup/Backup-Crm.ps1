[CmdletBinding()]
param(
  [string]$ConfigPath = 'C:\ProgramData\Caracola\config\production.json',
  [switch]$SkipPrune
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\common\Crm.Common.psm1') -Force
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$restic = Get-CrmExecutable -ConfiguredPath $config.backup.resticPath -Name 'restic'
$pgDump = Get-CrmExecutable -ConfiguredPath $config.backup.pgDumpPath -Name 'pg_dump'
$statePath = $config.backup.statusFile
$attemptAt = [DateTime]::UtcNow.ToString('o')
$stagingRoot = Join-Path $config.dataRoot 'backup-staging'
$staging = Join-Path $stagingRoot ([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))
$lockPath = Join-Path $config.dataRoot 'state\backup.lock'
$lock = $null
$dbPassword = $null

function Invoke-ResticBackup {
  param([string]$Repository, [string]$PasswordSecret, [string]$Target, [string]$ImagesPath, [switch]$Prune)
  if ([string]::IsNullOrWhiteSpace($Repository) -or [string]::IsNullOrWhiteSpace($PasswordSecret)) { return $null }
  $secretFile = Join-Path $staging ("restic-" + [Guid]::NewGuid().ToString('N') + '.tmp')
  try {
    Unprotect-CrmSecret -Path $PasswordSecret | Set-Content -LiteralPath $secretFile -NoNewline -Encoding UTF8
    $environment = @{ RESTIC_REPOSITORY = $Repository; RESTIC_PASSWORD_FILE = $secretFile }
    $probe = Invoke-CrmProcess -FilePath $restic -ArgumentList @('snapshots','--json') -Environment $environment -AllowFailure
    if ($probe.ExitCode -ne 0) { [void](Invoke-CrmProcess -FilePath $restic -ArgumentList @('init') -Environment $environment) }
    $targets = @('backup','--tag','crm','--tag','phase7',$Target)
    if (Test-Path -LiteralPath $ImagesPath -PathType Container) { $targets += $ImagesPath }
    [void](Invoke-CrmProcess -FilePath $restic -ArgumentList $targets -Environment $environment)
    [void](Invoke-CrmProcess -FilePath $restic -ArgumentList @('check','--read-data-subset=5%') -Environment $environment)
    if ($Prune) {
      [void](Invoke-CrmProcess -FilePath $restic -ArgumentList @('forget','--keep-daily','7','--keep-weekly','4','--keep-monthly','6','--prune') -Environment $environment)
    }
    $snapshots = (Invoke-CrmProcess -FilePath $restic -ArgumentList @('snapshots','--latest','1','--json') -Environment $environment).StdOut | ConvertFrom-Json
    if ($snapshots -and $snapshots.Count -gt 0) { return $snapshots[-1].short_id }
    return $null
  } finally {
    if (Test-Path -LiteralPath $secretFile) { Remove-Item -LiteralPath $secretFile -Force }
  }
}

try {
  $stateDirectory = Split-Path -Parent $lockPath
  New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
  $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  New-Item -ItemType Directory -Path $staging -Force | Out-Null
  $dumpPath = Join-Path $staging 'database.dump'
  $dbPassword = Unprotect-CrmSecret -Path $config.database.passwordSecret
  $dbEnvironment = @{ PGPASSWORD = $dbPassword }
  [void](Invoke-CrmProcess -FilePath $pgDump -ArgumentList @('--format=custom','--no-owner','--no-privileges',"--host=$($config.database.host)","--port=$($config.database.port)","--username=$($config.database.user)","--file=$dumpPath",$config.database.name) -Environment $dbEnvironment)
  $manifest = [ordered]@{
    formatVersion = 1
    createdAt = [DateTime]::UtcNow.ToString('o')
    applicationVersion = $config.version
    database = $config.database.name
    dumpFile = 'database.dump'
    dumpSha256 = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash
    imagesIncluded = (Test-Path -LiteralPath $config.backup.imagesPath -PathType Container)
  }
  Write-CrmJsonAtomically -Path (Join-Path $staging 'manifest.json') -Value $manifest
  $snapshotId = Invoke-ResticBackup -Repository $config.backup.repository -PasswordSecret $config.backup.passwordSecret -Target $staging -ImagesPath $config.backup.imagesPath -Prune:(-not $SkipPrune)
  $externalSnapshotId = Invoke-ResticBackup -Repository $config.backup.externalRepository -PasswordSecret $config.backup.externalPasswordSecret -Target $staging -ImagesPath $config.backup.imagesPath -Prune:(-not $SkipPrune)
  Write-CrmJsonAtomically -Path $statePath -Value ([ordered]@{
    status = 'ok'; lastAttemptAt = $attemptAt; lastSuccessAt = [DateTime]::UtcNow.ToString('o')
    snapshotId = $snapshotId; externalSnapshotId = $externalSnapshotId; repository = $config.backup.repository
    message = 'Backup cifrado y verificado correctamente.'
  })
  Write-Host "Backup correcto. Snapshot local: $snapshotId" -ForegroundColor Green
} catch {
  $lastSuccessAt = $null
  $previousSnapshotId = $null
  if (Test-Path -LiteralPath $statePath -PathType Leaf) {
    try {
      $previousState = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
      $lastSuccessAt = $previousState.lastSuccessAt
      $previousSnapshotId = $previousState.snapshotId
    } catch { }
  }
  Write-CrmJsonAtomically -Path $statePath -Value ([ordered]@{
    status = 'failed'; lastAttemptAt = $attemptAt; lastSuccessAt = $lastSuccessAt
    snapshotId = $previousSnapshotId; repository = $config.backup.repository; message = $_.Exception.Message
  })
  throw
} finally {
  $dbPassword = $null
  if ($lock) { $lock.Dispose() }
  if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
}

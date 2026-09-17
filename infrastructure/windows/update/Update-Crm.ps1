#requires -Version 5.1
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][string]$ReleasePath,
    [string]$ConfigPath = 'C:\ProgramData\Caracola\config\production.json',
    [int]$HealthTimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'
$windowsRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Import-Module (Join-Path $windowsRoot 'common\Crm.Common.psm1') -Force
Assert-CrmAdministrator

$releaseRoot = (Resolve-Path -LiteralPath $ReleasePath).Path
$manifest = Get-Content -LiteralPath (Join-Path $releaseRoot 'release-manifest.json') -Raw | ConvertFrom-Json
foreach ($entry in $manifest.files) {
    if ([IO.Path]::IsPathRooted($entry.path) -or $entry.path -match '(^|/)\.\.(/|$)') { throw "Unsafe manifest path: $($entry.path)" }
    $candidate = Join-Path $releaseRoot ($entry.path.Replace('/', '\'))
    if (-not (Test-CrmFileHash -Path $candidate -ExpectedSha256 $entry.sha256)) { throw "Release verification failed: $($entry.path)" }
}

$installRoot = 'C:\Program Files\Caracola'
$currentLink = Join-Path $installRoot 'current'
$previousTarget = (Get-Item -LiteralPath $currentLink -ErrorAction Stop).Target
$newTarget = Join-Path $installRoot "versions\$($manifest.version)"
if (Test-Path -LiteralPath $newTarget) { throw "Version already exists: $newTarget" }
if (-not $PSCmdlet.ShouldProcess($newTarget, "Update CRM to $($manifest.version)")) { return }

& (Join-Path $previousTarget 'infrastructure\windows\backup\Backup-Crm.ps1') -ConfigPath $ConfigPath
New-Item -ItemType Directory -Path $newTarget -Force | Out-Null
Copy-Item -Path (Join-Path $releaseRoot '*') -Destination $newTarget -Recurse -Force

foreach ($service in @('CrmWeb', 'CrmApi')) { Stop-Service -Name $service -Force -ErrorAction Stop }

try {
    Remove-Item -LiteralPath $currentLink -Force
    New-Item -ItemType Junction -Path $currentLink -Target $newTarget | Out-Null

    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    $password = Unprotect-CrmSecret -Path 'C:\ProgramData\Caracola\secrets\database-password.dpapi'
    $env:DATABASE_URL = "postgresql://$([Uri]::EscapeDataString([string]$config.database.user)):$([Uri]::EscapeDataString($password))@$($config.database.host):$($config.database.port)/$($config.database.name)"
    $node = Get-CrmExecutable -ConfiguredPath (Join-Path $newTarget 'runtime\\node.exe') -Name 'Node.js'
    Invoke-CrmProcess -FilePath $node -ArgumentList @((Join-Path $newTarget 'node_modules\prisma\build\index.js'), 'migrate', 'deploy', '--schema', (Join-Path $newTarget 'apps\api\prisma\schema.prisma')) | Out-Null
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

    foreach ($service in @('CrmApi', 'CrmWeb')) { Start-Service -Name $service }
    $deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
    do {
        Start-Sleep -Seconds 2
        try { $healthy = (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4000/api/v1/health' -TimeoutSec 5).StatusCode -eq 200 } catch { $healthy = $false }
    } until ($healthy -or (Get-Date) -ge $deadline)
    if (-not $healthy) { throw 'The new API did not become healthy before the timeout.' }
    Write-Host "Updated successfully to $($manifest.version)."
} catch {
    foreach ($service in @('CrmWeb', 'CrmApi')) { Stop-Service -Name $service -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $currentLink) { Remove-Item -LiteralPath $currentLink -Force }
    New-Item -ItemType Junction -Path $currentLink -Target $previousTarget | Out-Null
    foreach ($service in @('CrmApi', 'CrmWeb')) { Start-Service -Name $service -ErrorAction SilentlyContinue }
    throw "Update rolled back to the previous application version. Database migrations are forward-only and must remain backward compatible. $($_.Exception.Message)"
} finally {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}

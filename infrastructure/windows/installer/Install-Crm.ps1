#requires -Version 5.1
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][string]$ReleasePath,
    [string]$ConfigPath,
    [switch]$SkipDatabaseMigration
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$common = Join-Path (Split-Path -Parent $scriptRoot) 'common\Crm.Common.psm1'
Import-Module $common -Force
Assert-CrmAdministrator

$releaseRoot = (Resolve-Path -LiteralPath $ReleasePath).Path
$manifestPath = Join-Path $releaseRoot 'release-manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'release-manifest.json is required.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1 -or -not $manifest.version) { throw 'Unsupported release manifest.' }

foreach ($entry in $manifest.files) {
    if ([IO.Path]::IsPathRooted($entry.path) -or $entry.path -match '(^|/)\.\.(/|$)') {
        throw "Unsafe manifest path: $($entry.path)"
    }
    $candidate = Join-Path $releaseRoot ($entry.path.Replace('/', '\'))
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { throw "Missing release file: $($entry.path)" }
    if (-not (Test-CrmFileHash -Path $candidate -ExpectedSha256 $entry.sha256)) {
        throw "Checksum mismatch: $($entry.path)"
    }
}

$installRoot = 'C:\Program Files\CRM Local de Ropa'
$dataRoot = 'C:\ProgramData\CRM-LocalDeRopa'
$versionRoot = Join-Path $installRoot "versions\$($manifest.version)"
$currentLink = Join-Path $installRoot 'current'
$configTarget = Join-Path $dataRoot 'config\production.json'

if (-not $PSCmdlet.ShouldProcess($installRoot, "Install CRM version $($manifest.version)")) { return }

@($installRoot, $dataRoot, (Split-Path $configTarget), (Join-Path $dataRoot 'secrets'), (Join-Path $dataRoot 'state'), (Join-Path $dataRoot 'backups')) |
    ForEach-Object { New-Item -ItemType Directory -Path $_ -Force | Out-Null }

if (Test-Path -LiteralPath $versionRoot) { throw "Version already installed: $versionRoot" }
New-Item -ItemType Directory -Path $versionRoot -Force | Out-Null
Copy-Item -Path (Join-Path $releaseRoot '*') -Destination $versionRoot -Recurse -Force

if (-not (Test-Path -LiteralPath $configTarget)) {
    $sourceConfig = if ($ConfigPath) { $ConfigPath } else { Join-Path $versionRoot 'infrastructure\windows\config\production.example.json' }
    Copy-Item -LiteralPath $sourceConfig -Destination $configTarget
}
$config = Get-Content -LiteralPath $configTarget -Raw | ConvertFrom-Json
$config.version = [string]$manifest.version
Write-CrmJsonAtomically -Path $configTarget -Value $config

$apiEnv = Join-Path $dataRoot 'config\api.env'
$webEnv = Join-Path $dataRoot 'config\web.env'
if (-not (Test-Path -LiteralPath $apiEnv)) {
    @(
        'NODE_ENV=production'
        'PORT=4000'
        'WEB_ORIGIN=http://localhost:3000'
        'TRUST_PROXY=false'
        "PRODUCT_IMAGES_DIR=$dataRoot\images"
        "BACKUP_STATUS_FILE=$dataRoot\state\backup-status.json"
    ) | Set-Content -LiteralPath $apiEnv -Encoding UTF8
}
if (-not (Test-Path -LiteralPath $webEnv)) {
    @('NODE_ENV=production', 'INTERNAL_API_URL=http://127.0.0.1:4000') | Set-Content -LiteralPath $webEnv -Encoding UTF8
}

$secretScript = Join-Path $versionRoot 'infrastructure\windows\secrets\Set-CrmSecrets.ps1'
& $secretScript -ConfigPath $configTarget

if (-not $SkipDatabaseMigration) {
    $config = Get-Content -LiteralPath $configTarget -Raw | ConvertFrom-Json
    $password = Unprotect-CrmSecret -Path (Join-Path $dataRoot 'secrets\database-password.dpapi')
    $encodedUser = [Uri]::EscapeDataString([string]$config.database.user)
    $encodedPassword = [Uri]::EscapeDataString($password)
    $env:DATABASE_URL = "postgresql://${encodedUser}:${encodedPassword}@$($config.database.host):$($config.database.port)/$($config.database.name)"
    $node = Get-CrmExecutable -ConfiguredPath (Join-Path $versionRoot 'runtime\\node.exe') -Name 'Node.js'
    Invoke-CrmProcess -FilePath $node -ArgumentList @((Join-Path $versionRoot 'node_modules\prisma\build\index.js'), 'migrate', 'deploy', '--schema', (Join-Path $versionRoot 'apps\api\prisma\schema.prisma')) | Out-Null
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}

if (Test-Path -LiteralPath $currentLink) { Remove-Item -LiteralPath $currentLink -Force }
New-Item -ItemType Junction -Path $currentLink -Target $versionRoot | Out-Null

$services = Join-Path $versionRoot 'infrastructure\windows\services\Install-CrmServices.ps1'
$winSw = Join-Path $versionRoot 'tools\\WinSW-x64.exe'
& $services -ConfigPath $configTarget -WinSwPath $winSw

if (-not (Get-NetFirewallRule -DisplayName 'CRM Local de Ropa (red privada)' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'CRM Local de Ropa (red privada)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Private | Out-Null
}

Write-Host "CRM Local de Ropa $($manifest.version) installed. Data remains in $dataRoot."

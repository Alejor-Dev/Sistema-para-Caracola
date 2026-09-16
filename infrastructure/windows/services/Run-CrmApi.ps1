[CmdletBinding()]
param([string]$ConfigPath = 'C:\ProgramData\CRM-LocalDeRopa\config\production.json')
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
Import-Module (Join-Path $config.installRoot 'current\infrastructure\windows\common\Crm.Common.psm1') -Force
$dbPassword = Unprotect-CrmSecret -Path $config.database.passwordSecret
$encodedUser = [Uri]::EscapeDataString([string]$config.database.user)
$encodedPassword = [Uri]::EscapeDataString($dbPassword)
$env:DATABASE_URL = "postgresql://${encodedUser}:${encodedPassword}@$($config.database.host):$($config.database.port)/$($config.database.name)?schema=public&connection_limit=10&pool_timeout=10"
$dbPassword = $null
$envFile = Join-Path $config.dataRoot 'config\api.env'
foreach ($line in Get-Content -LiteralPath $envFile) {
  if ($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)) { continue }
  $parts = $line -split '=', 2
  if ($parts.Count -eq 2) { [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1], 'Process') }
}
Set-Location -LiteralPath (Join-Path $config.installRoot 'current')
& $config.nodePath 'apps\api\dist\main.js'
exit $LASTEXITCODE

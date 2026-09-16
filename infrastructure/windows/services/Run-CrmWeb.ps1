[CmdletBinding()]
param([string]$ConfigPath = 'C:\ProgramData\CRM-LocalDeRopa\config\production.json')
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$envFile = Join-Path $config.dataRoot 'config\web.env'
foreach ($line in Get-Content -LiteralPath $envFile) {
  if ($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)) { continue }
  $parts = $line -split '=', 2
  if ($parts.Count -eq 2) { [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1], 'Process') }
}
Set-Location -LiteralPath (Join-Path $config.installRoot 'current')
& $config.nodePath 'node_modules\next\dist\bin\next' 'start' '-H' '0.0.0.0' '-p' '3000'
exit $LASTEXITCODE

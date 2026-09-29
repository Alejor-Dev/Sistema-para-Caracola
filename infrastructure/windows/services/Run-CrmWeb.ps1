[CmdletBinding()]
param([string]$ConfigPath = 'C:\ProgramData\Caracola\config\production.json')
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$envFile = Join-Path $config.dataRoot 'config\web.env'
foreach ($line in Get-Content -LiteralPath $envFile) {
  if ($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)) { continue }
  $parts = $line -split '=', 2
  if ($parts.Count -eq 2) { [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1], 'Process') }
}
Set-Location -LiteralPath (Join-Path $config.installRoot 'current')
$standalone = Join-Path $config.installRoot 'current\web\apps\web\server.js'
if (Test-Path -LiteralPath $standalone) {
  $env:HOSTNAME = '0.0.0.0'
  $env:PORT = '3000'
  & $config.nodePath $standalone
} else {
  & $config.nodePath 'node_modules\next\dist\bin\next' 'start' 'apps\web' '-H' '0.0.0.0' '-p' '3000'
}
exit $LASTEXITCODE

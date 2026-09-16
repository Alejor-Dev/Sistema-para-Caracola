#Requires -RunAsAdministrator
[CmdletBinding()]
param(
  [string]$ConfigPath = 'C:\ProgramData\CRM-LocalDeRopa\config\production.json'
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\common\Crm.Common.psm1') -Force
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

$dbPassword = Read-Host 'Contraseña del rol PostgreSQL crm_app' -AsSecureString
$resticPassword = Read-Host 'Contraseña nueva del repositorio restic' -AsSecureString
Protect-CrmSecret -Secret $dbPassword -Path $config.database.passwordSecret
Protect-CrmSecret -Secret $resticPassword -Path $config.backup.passwordSecret

foreach ($path in @($config.database.passwordSecret, $config.backup.passwordSecret)) {
  & icacls.exe $path /inheritance:r /grant:r 'SYSTEM:F' 'Administrators:F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se pudieron restringir los permisos de $path" }
}
Write-Host 'Secretos protegidos con DPAPI de máquina y ACL restringida.' -ForegroundColor Green

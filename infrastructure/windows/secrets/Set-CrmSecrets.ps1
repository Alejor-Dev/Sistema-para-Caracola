#Requires -RunAsAdministrator
[CmdletBinding()]
param(
  [string]$ConfigPath = 'C:\ProgramData\Caracola\config\production.json',
  [Security.SecureString]$DatabasePassword,
  [Security.SecureString]$ResticPassword
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\common\Crm.Common.psm1') -Force
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

$interactive = -not $DatabasePassword -and -not $ResticPassword

if (-not $DatabasePassword) {
  if ($interactive) {
    $DatabasePassword = Read-Host 'Contraseña del rol PostgreSQL crm_app' -AsSecureString
  } else {
    $DatabasePassword = New-CrmRandomSecret -Suffix '-D8!'
  }
}

if (-not $ResticPassword) {
  if ($interactive) {
    $ResticPassword = Read-Host 'Contraseña nueva del repositorio restic' -AsSecureString
  } else {
    $ResticPassword = New-CrmRandomSecret -Suffix '-R3!'
  }
}

Protect-CrmSecret -Secret $DatabasePassword -Path $config.database.passwordSecret
Protect-CrmSecret -Secret $ResticPassword -Path $config.backup.passwordSecret

foreach ($path in @($config.database.passwordSecret, $config.backup.passwordSecret)) {
  & icacls.exe $path /inheritance:r /grant:r 'SYSTEM:F' 'Administrators:F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se pudieron restringir los permisos de $path" }
}
Write-Host 'Secretos protegidos con DPAPI de máquina y ACL restringida.' -ForegroundColor Green
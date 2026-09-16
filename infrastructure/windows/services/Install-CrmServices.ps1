#Requires -RunAsAdministrator
[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$ConfigPath = 'C:\ProgramData\CRM-LocalDeRopa\config\production.json',
  [Parameter(Mandatory)][string]$WinSwPath
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\common\Crm.Common.psm1') -Force
Assert-CrmAdministrator
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$serviceRoot = Join-Path $config.installRoot 'services'
New-Item -ItemType Directory -Path $serviceRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $config.dataRoot 'logs') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Run-CrmApi.ps1') -Destination $serviceRoot -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Run-CrmWeb.ps1') -Destination $serviceRoot -Force

foreach ($service in @('CrmApi','CrmWeb')) {
  $exe = Join-Path $serviceRoot "$service.exe"
  $xml = Join-Path $serviceRoot "$service.xml"
  Copy-Item -LiteralPath $WinSwPath -Destination $exe -Force
  $content = Get-Content -LiteralPath (Join-Path $PSScriptRoot "$service.xml.template") -Raw
  $content = $content.Replace('{{SERVICE_ROOT}}',$serviceRoot).Replace('{{CONFIG_PATH}}',$ConfigPath).Replace('{{INSTALL_ROOT}}',$config.installRoot).Replace('{{DATA_ROOT}}',$config.dataRoot).Replace('{{POSTGRES_SERVICE}}',$config.postgresService)
  Set-Content -LiteralPath $xml -Value $content -Encoding UTF8
  if ($PSCmdlet.ShouldProcess($service, 'Instalar servicio Windows')) {
    $existing = Get-Service -Name $service -ErrorAction SilentlyContinue
    if ($existing) { & $exe stop; & $exe uninstall }
    & $exe install
    if ($LASTEXITCODE -ne 0) { throw "No se pudo instalar $service." }
    & sc.exe failure $service reset= 3600 actions= restart/10000/restart/30000/none/0 | Out-Null
    & $exe start
  }
}

$backupScript = Join-Path $config.installRoot 'current\infrastructure\windows\backup\Backup-Crm.ps1'
$quote = [char]34
$taskArguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File $quote$backupScript$quote -ConfigPath $quote$ConfigPath$quote"
$taskAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $taskArguments
$time = [DateTime]::ParseExact($config.backup.schedule, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture)
$triggers = @((New-ScheduledTaskTrigger -Daily -At $time), (New-ScheduledTaskTrigger -AtStartup -RandomDelay (New-TimeSpan -Minutes 10)))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 4)
if ($PSCmdlet.ShouldProcess('CRM Local de Ropa - Backup', 'Registrar tarea programada')) {
  Register-ScheduledTask -TaskName 'CRM Local de Ropa - Backup' -Action $taskAction -Trigger $triggers -Settings $settings -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
}

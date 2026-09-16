#requires -Version 5.1
[CmdletBinding(SupportsShouldProcess, ConfirmImpact='High')]
param([switch]$RemoveData)

$ErrorActionPreference = 'Stop'
$common = Join-Path (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)) 'common\Crm.Common.psm1'
Import-Module $common -Force
Assert-CrmAdministrator

if (-not $PSCmdlet.ShouldProcess('CRM Local de Ropa', 'Uninstall services and application files')) { return }

foreach ($service in @('CrmApi', 'CrmWeb')) {
    $svc = Get-Service -Name $service -ErrorAction SilentlyContinue
    if ($svc) {
        Stop-Service -Name $service -Force -ErrorAction SilentlyContinue
        sc.exe delete $service | Out-Null
    }
}
Unregister-ScheduledTask -TaskName 'CRM Local de Ropa - Backup' -Confirm:$false -ErrorAction SilentlyContinue
Get-NetFirewallRule -DisplayName 'CRM Local de Ropa (red privada)' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
$installRoot = 'C:\Program Files\CRM Local de Ropa'
if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force }

$dataRoot = 'C:\ProgramData\CRM-LocalDeRopa'
if ($RemoveData) {
    if ($PSCmdlet.ShouldProcess($dataRoot, 'Permanently remove configuration, secrets, database backups and state')) {
        Remove-Item -LiteralPath $dataRoot -Recurse -Force -ErrorAction SilentlyContinue
        Write-Warning 'Application data and backups were removed.'
    }
} else {
    Write-Host "Application removed. Data and backups were preserved in $dataRoot."
}

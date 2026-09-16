#Requires -RunAsAdministrator
[CmdletBinding(SupportsShouldProcess)]
param([ValidateRange(1, 65535)][int]$Port = 3000)

$ruleName = 'CRM Local de Ropa - Web privada'
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Output "La regla '$ruleName' ya existe."
    return
}
if ($PSCmdlet.ShouldProcess("TCP $Port en perfil Private", 'Crear regla de firewall')) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Private | Out-Null
    Write-Output "Regla creada para TCP $Port únicamente en redes privadas."
}

[CmdletBinding()]
param([ValidateRange(1, 65535)][int]$Port = 3000)

$addresses = Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred -ErrorAction SilentlyContinue |
    Where-Object {
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|Docker'
    } |
    Sort-Object InterfaceMetric, InterfaceAlias |
    Select-Object -ExpandProperty IPAddress -Unique

Write-Output "PC principal: http://127.0.0.1:$Port"
foreach ($address in $addresses) {
    Write-Output "Celulares y otras PCs: http://${address}:$Port"
}
if (-not $addresses) { Write-Warning 'No se detectó una dirección IPv4 de red local activa.' }

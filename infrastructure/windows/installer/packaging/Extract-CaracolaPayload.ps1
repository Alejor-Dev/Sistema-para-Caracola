#requires -Version 5.1
param(
    [Parameter(Mandatory)][string]$PayloadZip,
    [Parameter(Mandatory)][string]$BootstrapDir
)

$ErrorActionPreference = 'Stop'
try {
    Expand-Archive -LiteralPath $PayloadZip -DestinationPath $BootstrapDir -Force
    exit 0
} catch {
    Write-Error "No se pudo extraer el paquete del servidor: $($_.Exception.Message)"
    exit 1
}
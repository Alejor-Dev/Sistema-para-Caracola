[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ConfigPath,
    [string]$CloudflaredPath = 'cloudflared.exe'
)

$resolved = (Resolve-Path -LiteralPath $ConfigPath -ErrorAction Stop).Path
$content = Get-Content -LiteralPath $resolved -Raw
if ($content -match 'REEMPLAZAR_|ejemplo\.com') { throw 'La configuración todavía contiene valores de ejemplo.' }
if ($content -notmatch '(?m)^\s*-\s+service:\s+http_status:404\s*$') { throw 'Falta la regla final obligatoria http_status:404.' }
if (-not (Get-Command $CloudflaredPath -ErrorAction SilentlyContinue)) { throw "No se encontró cloudflared en '$CloudflaredPath'." }

& $CloudflaredPath tunnel --config $resolved ingress validate
if ($LASTEXITCODE -ne 0) { throw "cloudflared rechazó la configuración (código $LASTEXITCODE)." }
Write-Output 'Configuración de Cloudflare Tunnel válida.'

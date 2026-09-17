#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$PayloadPath,
    [Parameter(Mandatory)][ValidatePattern('^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$')][string]$Version,
    [string]$OutputPath = (Join-Path $PayloadPath 'release-manifest.json')
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $PayloadPath).Path
$files = Get-ChildItem -LiteralPath $root -File -Recurse |
    Where-Object { $_.FullName -ne $OutputPath } |
    Sort-Object FullName |
    ForEach-Object {
        $relative = $_.FullName.Substring($root.Length).TrimStart('\').Replace('\', '/')
        [ordered]@{
            path = $relative
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            size = $_.Length
        }
    }

$manifest = [ordered]@{
    schemaVersion = 1
    product = 'Caracola'
    version = $Version
    createdAt = [DateTime]::UtcNow.ToString('o')
    files = @($files)
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Host "Manifest created: $OutputPath ($($files.Count) files)"

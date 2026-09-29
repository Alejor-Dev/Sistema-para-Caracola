#requires -Version 7.0
[CmdletBinding()]
param([Parameter(Mandatory)][string]$Destination)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$target = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $target) { throw "Use a new staging directory: $target" }
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item "$repo\package.json","$repo\package-lock.json" -Destination $target
foreach ($relative in @('apps\api','apps\web','apps\desktop','packages\contracts')) {
    $directory = Join-Path $target $relative
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    Copy-Item (Join-Path $repo "$relative\package.json") $directory
}
Copy-Item "$repo\apps\api\dist","$repo\apps\api\prisma" -Destination "$target\apps\api" -Recurse
Copy-Item "$repo\packages\contracts\dist" -Destination "$target\packages\contracts" -Recurse
Push-Location $target
try {
    npm ci --omit=dev --workspace=@crm/api --ignore-scripts --no-audit --no-fund
    & node.exe 'node_modules\prisma\build\index.js' generate --schema 'apps\api\prisma\schema.prisma'
} finally { Pop-Location }

# Materialize the single workspace link so the package never depends on a build-machine junction.
$contractLink = Join-Path $target 'node_modules\@crm\contracts'
if (Test-Path -LiteralPath $contractLink) {
    $link = Get-Item -LiteralPath $contractLink -Force
    if (-not ($link.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Expected the contracts workspace junction.' }
    $link.Delete()
}
Copy-Item "$target\packages\contracts" -Destination $contractLink -Recurse

$standalone = Join-Path $repo 'apps\web\.next\standalone'
if (-not (Test-Path "$standalone\apps\web\server.js")) { throw 'Next.js standalone output is missing.' }
Copy-Item $standalone -Destination "$target\web" -Recurse
Copy-Item "$repo\apps\web\.next\static" -Destination "$target\web\apps\web\.next\static" -Recurse
Copy-Item "$repo\apps\web\public" -Destination "$target\web\apps\web\public" -Recurse
New-Item -ItemType Directory "$target\infrastructure","$target\runtime","$target\tools" -Force | Out-Null
Copy-Item "$repo\infrastructure\windows" "$target\infrastructure\windows" -Recurse
Copy-Item (Get-Command node.exe).Source "$target\runtime\node.exe"
$files = @(Get-ChildItem $target -Recurse -File)
Write-Host "Runtime payload: $($files.Count) files, $([math]::Round(($files | Measure-Object Length -Sum).Sum / 1MB)) MiB before prerequisites."

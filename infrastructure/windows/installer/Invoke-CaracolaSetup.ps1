#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ReleasePath,
    [Parameter(Mandatory)][string]$PostgresInstaller
)
$ErrorActionPreference = 'Stop'
# The setup runs from an elevated, no-profile PowerShell process.  Some host
# environments prepend their own module folders (for example Codex runtimes),
# which can load a second Microsoft.PowerShell.Security module and make
# Get-AuthenticodeSignature fail before PostgreSQL is installed.
$systemModulePaths = @(
    (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\Modules'),
    (Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules')
) | Where-Object { Test-Path -LiteralPath $_ }
$env:PSModulePath = $systemModulePaths -join ';'
$dataRoot = 'C:\ProgramData\Caracola'
New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
$started = Get-Date
$transcriptStarted = $false
try {
    try {
        Start-Transcript -Path (Join-Path $dataRoot 'setup.log') -Force | Out-Null
        $transcriptStarted = $true
    } catch {
        Write-Warning 'No se pudo abrir setup.log. Los registros de progreso y error siguen disponibles.'
    }
    if (-not [Environment]::Is64BitProcess) {
        throw 'El instalador de Caracola requiere Windows PowerShell de 64 bits.'
    }
    & (Join-Path $PSScriptRoot 'Complete-CrmInstall.ps1') -ReleasePath $ReleasePath -PostgresInstaller $PostgresInstaller -UsePreparedRelease
    [ordered]@{ version = (Get-Content (Join-Path $ReleasePath 'release-manifest.json') -Raw | ConvertFrom-Json).version; completedAt = [DateTime]::UtcNow.ToString('o'); durationSeconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1) } |
        ConvertTo-Json | Set-Content (Join-Path $dataRoot 'install-success.json') -Encoding UTF8
} catch {
    $message = [regex]::Replace($_.Exception.Message, '(?i)(--(?:super|service)password\s+)\S+', '$1[redacted]')
    $message | Set-Content (Join-Path $dataRoot 'install-error.log') -Encoding UTF8
    Write-Host "ERROR: $message"
    exit 1
} finally {
    if ($transcriptStarted) { Stop-Transcript -ErrorAction SilentlyContinue | Out-Null }
}
exit 0

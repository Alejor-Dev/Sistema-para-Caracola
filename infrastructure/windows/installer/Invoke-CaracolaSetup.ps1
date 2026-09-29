#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ReleasePath,
    [Parameter(Mandatory)][string]$PostgresInstaller
)
$ErrorActionPreference = 'Stop'
$dataRoot = 'C:\ProgramData\Caracola'
New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
$started = Get-Date
$transcriptStarted = $false
try {
    Start-Transcript -Path (Join-Path $dataRoot 'setup.log') -Force | Out-Null
    $transcriptStarted = $true
    & (Join-Path $PSScriptRoot 'Complete-CrmInstall.ps1') -ReleasePath $ReleasePath -PostgresInstaller $PostgresInstaller -UsePreparedRelease
    [ordered]@{ version = (Get-Content (Join-Path $ReleasePath 'release-manifest.json') -Raw | ConvertFrom-Json).version; completedAt = [DateTime]::UtcNow.ToString('o'); durationSeconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1) } |
        ConvertTo-Json | Set-Content (Join-Path $dataRoot 'install-success.json') -Encoding UTF8
} catch {
    $message = [regex]::Replace($_.Exception.Message, '(?i)(--(?:super|service)password\s+)\S+', '$1[redacted]')
    $message | Set-Content (Join-Path $dataRoot 'install-error.log') -Encoding UTF8
    Write-Host "ERROR: $message"
    exit 1
} finally {
    if ($transcriptStarted) { Stop-Transcript | Out-Null }
}
exit 0

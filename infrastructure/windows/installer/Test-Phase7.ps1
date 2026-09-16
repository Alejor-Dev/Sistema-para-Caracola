#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$windowsRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$errors = @()

Get-ChildItem -LiteralPath $windowsRoot -File -Recurse | Where-Object { $_.Extension -in @('.ps1', '.psm1') } | ForEach-Object {
    $tokens = $null
    $parseErrors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$parseErrors)
    if ($parseErrors.Count -gt 0) {
        $errors += $parseErrors | ForEach-Object { "$($_.Extent.File):$($_.Extent.StartLineNumber) $($_.Message)" }
    }
}
Get-ChildItem -LiteralPath $windowsRoot -Filter *.json -Recurse | ForEach-Object {
    try { Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json | Out-Null } catch { $errors += "$($_.FullName): $($_.Exception.Message)" }
}
Get-ChildItem -LiteralPath $windowsRoot -Filter *.xml.template -Recurse | ForEach-Object {
    try { [xml](Get-Content -LiteralPath $_.FullName -Raw) | Out-Null } catch { $errors += "$($_.FullName): $($_.Exception.Message)" }
}
if ($errors.Count -gt 0) { throw ($errors -join [Environment]::NewLine) }

$restore = Join-Path $windowsRoot 'backup\Restore-Crm.ps1'
$example = Join-Path $windowsRoot 'config\production.example.json'
& $restore -ConfigPath $example -Snapshot 'latest' -TargetDatabase 'crm_restore_validation'
Write-Host 'Phase 7 PowerShell, JSON, XML and safe restore plan validated.' -ForegroundColor Green

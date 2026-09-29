#requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory)][string]$InstallerPath)
$ErrorActionPreference = 'Stop'
$clock = [Diagnostics.Stopwatch]::StartNew()
$process = Start-Process -FilePath $InstallerPath -ArgumentList '/S' -PassThru
while (-not $process.WaitForExit(20000)) {
    if ($clock.Elapsed.TotalMinutes -gt 18) { throw 'Installer exceeded 18 minutes.' }
    if (Test-Path 'C:\ProgramData\Caracola\install-progress.log') {
        Get-Content 'C:\ProgramData\Caracola\install-progress.log' -Tail 1 | Write-Host
    }
}
if ($process.ExitCode -ne 0) {
    if (Test-Path 'C:\ProgramData\Caracola\install-error.log') { Get-Content 'C:\ProgramData\Caracola\install-error.log' }
    throw "Installer exited with $($process.ExitCode)."
}
if (-not (Test-Path 'C:\ProgramData\Caracola\install-success.json')) { throw 'No installation completion record.' }
foreach ($name in @('postgresql-x64-17-caracola','CrmApi','CrmWeb')) {
    if ((Get-Service $name).Status -ne 'Running') { throw "$name is not running." }
}
$base = 'http://127.0.0.1:3000'
Invoke-WebRequest "$base/" -UseBasicParsing | Out-Null
Invoke-WebRequest "$base/api/v1/health" -UseBasicParsing | Out-Null
$status = Invoke-RestMethod "$base/api/v1/setup/status"
if ($status.initialized) { throw 'Fresh install contains an existing administrator.' }
$account = @{ username = 'installation_test'; displayName = 'Installation Test'; password = 'Test-' + [Guid]::NewGuid().ToString('N') + '-Aa1!' }
Invoke-RestMethod "$base/api/v1/setup/initialize" -Method Post -ContentType 'application/json' -Body ($account | ConvertTo-Json) | Out-Null
$login = @{ username = $account.username; password = $account.password } | ConvertTo-Json
Invoke-WebRequest "$base/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body $login -UseBasicParsing | Out-Null
Restart-Service CrmApi -Force
Start-Service CrmWeb
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
    try {
        $status = Invoke-RestMethod "$base/api/v1/setup/status"
        if ($status.initialized) { $ready = $true; break }
    } catch { }
    Start-Sleep 3
}
if (-not $ready) { throw 'Restart did not preserve the initialized application.' }
@{ installationAndTestSeconds = [math]::Round($clock.Elapsed.TotalSeconds, 1); firstAdministrator = 'passed'; login = 'passed'; serviceRestart = 'passed' } |
    ConvertTo-Json | Set-Content 'C:\ProgramData\Caracola\test-result.json'
Get-Content 'C:\ProgramData\Caracola\test-result.json'

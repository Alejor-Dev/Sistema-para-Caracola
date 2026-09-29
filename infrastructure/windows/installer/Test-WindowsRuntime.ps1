#requires -Version 5.1
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\common\Crm.Common.psm1') -Force
$first = New-CrmRandomSecret -Suffix '-Test!'
$second = New-CrmRandomSecret -Suffix '-Test!'
if ($first.Length -lt 48 -or (Convert-CrmSecureStringToPlain $first) -eq (Convert-CrmSecureStringToPlain $second)) {
    throw 'Random secrets must be long, independent and supported on Windows PowerShell.'
}
$result = Invoke-CrmProcess -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList @('-NoProfile','-NonInteractive','-Command',"Write-Output 'runtime-ok'")
if ($result.StdOut.Trim() -ne 'runtime-ok') { throw 'Child process output is incorrect.' }
$secretTest = Join-Path ([IO.Path]::GetTempPath()) ('caracola-dpapi-' + [Guid]::NewGuid().ToString('N') + '.tmp')
try {
    Protect-CrmSecret -Secret $first -Path $secretTest
    if ((Unprotect-CrmSecret -Path $secretTest) -ne (Convert-CrmSecureStringToPlain $first)) {
        throw 'Machine-protected secrets did not round trip.'
    }
} finally {
    if (Test-Path -LiteralPath $secretTest) { Remove-Item -LiteralPath $secretTest -Force }
}
Write-Host "Windows PowerShell $($PSVersionTable.PSVersion) runtime checks passed."

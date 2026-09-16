Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-CrmAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Esta operación debe ejecutarse desde PowerShell como administrador.'
  }
}

function Get-CrmExecutable {
  param([Parameter(Mandatory)][string]$ConfiguredPath, [Parameter(Mandatory)][string]$Name)
  if (Test-Path -LiteralPath $ConfiguredPath -PathType Leaf) { return (Resolve-Path -LiteralPath $ConfiguredPath).Path }
  $command = Get-Command $ConfiguredPath -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  throw "No se encontró $Name en '$ConfiguredPath'."
}

function Invoke-CrmProcess {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [string[]]$ArgumentList = @(),
    [hashtable]$Environment = @{},
    [switch]$AllowFailure
  )
  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = $FilePath
  $start.UseShellExecute = $false
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $start.CreateNoWindow = $true
  if ($start.PSObject.Properties.Name -contains 'ArgumentList') {
    foreach ($argument in $ArgumentList) { [void]$start.ArgumentList.Add($argument) }
  } else {
    $start.Arguments = (($ArgumentList | ForEach-Object { '"' + ([string]$_).Replace('"','\"') + '"' }) -join ' ')
  }
  foreach ($key in $Environment.Keys) { $start.EnvironmentVariables[$key] = [string]$Environment[$key] }
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $start
  [void]$process.Start()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0 -and -not $AllowFailure) {
    throw "$FilePath finalizó con código $($process.ExitCode): $stderr"
  }
  [pscustomobject]@{ ExitCode = $process.ExitCode; StdOut = $stdout; StdErr = $stderr }
}

function Write-CrmJsonAtomically {
  param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)]$Value)
  $parent = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  $temporary = "$Path.tmp"
  $Value | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $temporary -Encoding UTF8
  Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Protect-CrmSecret {
  param([Parameter(Mandatory)][Security.SecureString]$Secret, [Parameter(Mandatory)][string]$Path)
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $bytes = [Text.Encoding]::UTF8.GetBytes($plain)
    $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [Convert]::ToBase64String($protected) | Set-Content -LiteralPath $Path -Encoding ASCII
  } finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
    $plain = $null
  }
}

function Unprotect-CrmSecret {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "No existe el secreto protegido: $Path" }
  $protected = [Convert]::FromBase64String((Get-Content -LiteralPath $Path -Raw).Trim())
  $bytes = [Security.Cryptography.ProtectedData]::Unprotect($protected, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
  try { return [Text.Encoding]::UTF8.GetString($bytes) }
  finally { [Array]::Clear($bytes, 0, $bytes.Length) }
}

function Test-CrmFileHash {
  param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$ExpectedSha256)
  $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
  if ($actual -ne $ExpectedSha256) { throw "Checksum inválido para $Path. Esperado $ExpectedSha256, obtenido $actual." }
  return $true
}

Export-ModuleMember -Function Assert-CrmAdministrator,Get-CrmExecutable,Invoke-CrmProcess,Write-CrmJsonAtomically,Protect-CrmSecret,Unprotect-CrmSecret,Test-CrmFileHash

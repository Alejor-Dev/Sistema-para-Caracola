[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$osCaption = [Environment]::OSVersion.VersionString
$osVersion = [Environment]::OSVersion.Version
$memoryBytes = [GC]::GetGCMemoryInfo().TotalAvailableMemoryBytes
$processorCount = [Environment]::ProcessorCount

try {
  $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  $computerInfo = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
  $osCaption = $osInfo.Caption
  $osVersion = [version]$osInfo.Version
  $memoryBytes = [int64]$computerInfo.TotalPhysicalMemory
  $processorCount = $computerInfo.NumberOfLogicalProcessors
} catch {
  # El diagnóstico también debe funcionar sin permisos WMI.
}

$systemRoot = [System.IO.Path]::GetPathRoot([Environment]::SystemDirectory)
$systemDrive = [System.IO.DriveInfo]::new($systemRoot)
$postgres = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1

$result = [ordered]@{
  compatible = [Environment]::Is64BitOperatingSystem -and $osVersion -ge [version]'10.0' -and $memoryBytes -ge 4GB -and $systemDrive.AvailableFreeSpace -ge 10GB
  windows = $osCaption
  architecture = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
  memoryGb = [math]::Round($memoryBytes / 1GB, 1)
  logicalProcessors = $processorCount
  freeDiskGb = [math]::Round($systemDrive.AvailableFreeSpace / 1GB, 1)
  postgresService = if ($postgres) { $postgres.Name } else { $null }
  postgresStatus = if ($postgres) { [string]$postgres.Status } else { 'not-installed' }
  dockerRequired = $false
}

$result | ConvertTo-Json

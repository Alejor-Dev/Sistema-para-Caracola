#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ReleasePath,
    [string]$ConfigPath = 'C:\ProgramData\Caracola\config\production.json',
    [Security.SecureString]$SuperPassword,
    [Security.SecureString]$DatabasePassword,
    [Security.SecureString]$ResticPassword,
    [switch]$SkipDatabaseMigration,
    [int]$HealthTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
$windowsRoot = Split-Path -Parent $PSScriptRoot
$common = Join-Path $windowsRoot 'common\Crm.Common.psm1'
Import-Module $common -Force
Assert-CrmAdministrator

$releaseRoot = (Resolve-Path -LiteralPath $ReleasePath).Path
$manifestPath = Join-Path $releaseRoot 'release-manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'release-manifest.json is required.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1 -or -not $manifest.version) { throw 'Unsupported release manifest.' }
$version = [string]$manifest.version

$dataRoot = 'C:\ProgramData\Caracola'
$installRoot = 'C:\Program Files\Caracola'

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    $progressPath = Join-Path $dataRoot 'install-progress.log'
    New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
    ('{0:u} {1}' -f (Get-Date), $Message) | Add-Content -LiteralPath $progressPath -Encoding UTF8
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Test-CrmHttpReady {
    param([string]$Url, [int]$TimeoutSeconds)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) { return $true }
        } catch { }
        Start-Sleep -Seconds 3
    }
    return $false
}

function Test-WebView2Runtime {
    $keys = @(
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
        'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
    )
    foreach ($key in $keys) {
        $pv = (Get-ItemProperty -LiteralPath $key -Name 'pv' -ErrorAction SilentlyContinue).pv
        if ($pv) { return $true }
    }
    return $false
}

Write-Step 'Prerrequisitos del equipo'
$prereqScript = Join-Path $windowsRoot 'Test-ClientPrerequisites.ps1'
$prereqOutput = & $prereqScript | Out-String
$prereq = $prereqOutput | ConvertFrom-Json
if (-not $prereq.compatible) {
    throw "Este equipo no cumple los requisitos mínimos: Windows x64 reciente, 4 GB de RAM y 10 GB libres. " +
        "Detalle: $($prereq.windows), $($prereq.memoryGb) GB RAM, $($prereq.freeDiskGb) GB libres."
}
Write-Host "Windows: $($prereq.windows) | RAM: $($prereq.memoryGb) GB | Disco: $($prereq.freeDiskGb) GB" -ForegroundColor Green
$postgresService = 'postgresql-x64-17-caracola'
$postgresPort = 5433
$pgVersionDir = 'C:\Program Files\PostgreSQL\17-Caracola'
$pgDataDir = Join-Path $dataRoot 'PostgreSQL\data'
if (Test-Path -LiteralPath (Join-Path $dataRoot 'config\production.json')) {
    throw 'Ya existe una instalación de Caracola. No se sobrescribirán sus datos.'
}
if (Get-Service -Name $postgresService,CrmApi,CrmWeb -ErrorAction SilentlyContinue) {
    throw 'Ya existen servicios de Caracola. Desinstale la versión anterior antes de continuar.'
}
foreach ($port in @($postgresPort, 3000, 4000)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "El puerto $port está ocupado. Cerrá el programa que lo usa antes de instalar."
    }
}

Write-Step 'PostgreSQL'
$pgSource = Join-Path $releaseRoot 'infrastructure\windows\config\postgres-source.json'
if (-not (Test-Path -LiteralPath $pgSource)) { throw 'postgres-source.json is missing from the release.' }
$pgMeta = Get-Content -LiteralPath $pgSource -Raw | ConvertFrom-Json
if (-not $pgMeta.sha256) { throw 'postgres-source.json has no sha256 pin.' }
$pgInstaller = Join-Path $releaseRoot ($pgMeta.localFile -replace '/', '\')

$installPostgres = Join-Path $windowsRoot 'postgresql\Install-Postgres.ps1'
& $installPostgres -InstallerPath $pgInstaller -ExpectedSha256 $pgMeta.sha256 -SuperPassword $SuperPassword -ServiceName $postgresService -ServerPort $postgresPort -Prefix $pgVersionDir -DataRoot $dataRoot

if (-not $SuperPassword -or $SuperPassword.Length -eq 0) {
    $superSecret = Join-Path $dataRoot 'secrets\postgres-super.dpapi'
    if (Test-Path -LiteralPath $superSecret) {
        $SuperPassword = ConvertTo-SecureString -String (Unprotect-CrmSecret -Path $superSecret) -AsPlainText -Force
    } else {
        throw 'No se conoce la contraseña del superusuario de PostgreSQL. Pase -SuperPassword o ejecute Complete-CrmInstall.ps1 de forma interactiva.'
    }
}

if (-not $DatabasePassword -or $DatabasePassword.Length -eq 0) {
    $DatabasePassword = New-CrmRandomSecret -Suffix '-D8!'
}
if (-not $ResticPassword -or $ResticPassword.Length -eq 0) {
    $ResticPassword = New-CrmRandomSecret -Suffix '-R3!'
}

$pgBinDir = Join-Path $pgVersionDir 'bin'
if (-not (Test-Path -LiteralPath (Join-Path $pgBinDir 'psql.exe'))) { throw 'No se encontró PostgreSQL privado para Caracola.' }

Write-Step 'Inicialización de base y rol'
$initScript = Join-Path $windowsRoot 'postgresql\Initialize-CrmDatabase.ps1'
& $initScript -PsqlPath (Join-Path $pgBinDir 'psql.exe') -Port $postgresPort -AdminPassword $SuperPassword -AppPassword $DatabasePassword
if ($LASTEXITCODE -ne 0) { throw 'Fallo al inicializar la base del CRM.' }

Write-Step 'Optimización de PostgreSQL'
$optimize = Join-Path $windowsRoot 'postgresql\Optimize-Postgres.ps1'
& $optimize -DataDirectory $pgDataDir
if ($LASTEXITCODE -ne 0) { throw 'Fallo al optimizar PostgreSQL.' }
$pgService = Get-Service -Name $postgresService
if ($pgService.Status -eq 'Running') { Restart-Service -Name $postgresService -Force }
else { Start-Service -Name $postgresService }
Write-Host "Servicio $postgresService reiniciado con la configuración optimizada." -ForegroundColor Green

Write-Step 'Instalación de Caracola'
$install = Join-Path $windowsRoot 'installer\Install-Crm.ps1'
$configTarget = Join-Path $dataRoot 'config\production.json'
New-Item -ItemType Directory -Path (Split-Path -Parent $configTarget) -Force | Out-Null
$config = Get-Content -LiteralPath (Join-Path $windowsRoot 'config\production.example.json') -Raw | ConvertFrom-Json
$config.postgresService = $postgresService
$config.database.port = $postgresPort
$config.backup.pgDumpPath = Join-Path $pgBinDir 'pg_dump.exe'
$config.backup.pgRestorePath = Join-Path $pgBinDir 'pg_restore.exe'
$config.backup.createdbPath = Join-Path $pgBinDir 'createdb.exe'
Write-CrmJsonAtomically -Path $configTarget -Value $config
$installArguments = @('-ReleasePath', $releaseRoot, '-DatabasePassword', $DatabasePassword, '-ResticPassword', $ResticPassword)
if ($SkipDatabaseMigration) { $installArguments += '-SkipDatabaseMigration' }
if ($ConfigPath -and (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) { $installArguments += '-ConfigPath', $ConfigPath }
& $install @installArguments

Write-Step 'WebView2 (necesario para la ventana de escritorio)'
if (-not (Test-WebView2Runtime)) {
    try {
        Write-Host 'WebView2 no está presente; se instala el runtime de Evergreen...' -ForegroundColor Yellow
        $webview2Setup = Join-Path $env:TEMP 'MicrosoftEdgeWebview2Setup.exe'
        Invoke-WebRequest 'https://go.microsoft.com/fwlink/p/?LinkID=2124703' -OutFile $webview2Setup
        $process = Start-Process -FilePath $webview2Setup -ArgumentList '/silent', '/install' -Wait -PassThru
        if ($process.ExitCode -ne 0) { throw "WebView2 setup exit $($process.ExitCode)" }
    } catch {
        Write-Host "Advertencia: no se pudo instalar WebView2. Use un navegador para abrir http://127.0.0.1:3000. Detalle: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host 'WebView2 disponible.' -ForegroundColor Green
}

Write-Step 'Health check'
$apiReady = Test-CrmHttpReady -Url 'http://127.0.0.1:4000/api/v1/health' -TimeoutSeconds $HealthTimeoutSeconds
$webReady = Test-CrmHttpReady -Url 'http://127.0.0.1:3000' -TimeoutSeconds $HealthTimeoutSeconds
if (-not $apiReady -or -not $webReady) {
    throw "La aplicación no respondió correctamente tras la instalación. API=$apiReady Web=$webReady. " +
        'Revisá los logs en C:\ProgramData\Caracola\logs.'
}

Write-Host "`nCaracola $version instalada y funcionando." -ForegroundColor Green
Write-Host 'Abra el sistema en http://127.0.0.1:3000 y complete el asistente del primer administrador.'

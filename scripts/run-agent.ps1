# Local Windows runner for pulsegrid-agent (client → Monitor gateway).
param(
  [string]$ServerId = "local-01",
  [Parameter(Mandatory = $true)]
  [string]$Monitor,
  [string]$Token = "",
  [string]$CaFile = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "agent\dist\pulsegrid-agent.exe"
if (-not $CaFile) {
  $CaFile = Join-Path $root "certs\ca.crt"
}

if (-not (Test-Path $exe)) {
  & (Join-Path $PSScriptRoot "build-agent.ps1")
}

if (-not (Test-Path $CaFile)) {
  throw "CA file not found: $CaFile (run scripts/generate-monitor-certs.ps1 first)"
}

$env:SERVER_ID = $ServerId
$env:MONITOR_ADDRESS = $Monitor
$env:MONITOR_CA_FILE = $CaFile
if ($Token) { $env:JOIN_TOKEN = $Token } else { Remove-Item Env:JOIN_TOKEN -ErrorAction SilentlyContinue }

Write-Host "Starting pulsegrid-agent SERVER_ID=$ServerId → $Monitor"
& $exe

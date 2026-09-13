# Local Windows runner for pulsegrid-agent.
param(
  [string]$ServerId = "local-01",
  [int]$Port = 50051
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "agent\dist\pulsegrid-agent.exe"

if (-not (Test-Path $exe)) {
  & (Join-Path $PSScriptRoot "build-agent.ps1")
}

$env:SERVER_ID = $ServerId
$env:PORT = "$Port"
Write-Host "Starting pulsegrid-agent SERVER_ID=$ServerId PORT=$Port"
& $exe

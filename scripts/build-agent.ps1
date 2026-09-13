# Build Pulsegrid agent for Windows + Linux.
param(
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$agentDir = Join-Path $root "agent"
if (-not $OutDir) { $OutDir = Join-Path $agentDir "dist" }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Push-Location $agentDir
try {
  Write-Host "Building Windows amd64 → pulsegrid-agent.exe"
  $env:CGO_ENABLED = "0"
  $ld = "-s -w -X github.com/pulsegrid/agent/internal/metrics.AgentVersion=1.2.0"
  $env:GOOS = "windows"
  $env:GOARCH = "amd64"
  go build -ldflags $ld -o (Join-Path $OutDir "pulsegrid-agent.exe") ./cmd/pulsegrid-agent

  Write-Host "Building Linux amd64 → pulsegrid-agent-linux-amd64"
  $env:GOOS = "linux"
  $env:GOARCH = "amd64"
  go build -ldflags $ld -o (Join-Path $OutDir "pulsegrid-agent-linux-amd64") ./cmd/pulsegrid-agent

  Write-Host "Building Linux arm64 → pulsegrid-agent-linux-arm64"
  $env:GOARCH = "arm64"
  go build -ldflags $ld -o (Join-Path $OutDir "pulsegrid-agent-linux-arm64") ./cmd/pulsegrid-agent

  Write-Host "Done:"
  Get-ChildItem $OutDir | Select-Object Name, Length, LastWriteTime
}
finally {
  Remove-Item Env:GOOS -ErrorAction SilentlyContinue
  Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
  Pop-Location
}

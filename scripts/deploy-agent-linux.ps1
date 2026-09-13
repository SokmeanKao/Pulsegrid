# Copy pulsegrid-agent to a Linux host over SCP and print run instructions.
# Password is prompted by ssh/scp — never pass secrets on the command line into git.
param(
  [Parameter(Mandatory = $true)][string]$HostAddress,
  [string]$User = "kali",
  [string]$ServerId = "kali-01",
  [int]$Port = 50051,
  [string]$RemoteDir = "~/pulsegrid"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$bin = Join-Path $root "agent\dist\pulsegrid-agent-linux-amd64"

if (-not (Test-Path $bin)) {
  Write-Host "Linux binary missing — building…"
  & (Join-Path $PSScriptRoot "build-agent.ps1")
}

if (-not (Test-Path $bin)) {
  throw "Build failed: $bin not found"
}

$target = "${User}@${HostAddress}"
Write-Host "Creating remote dir $RemoteDir on $target"
ssh $target "mkdir -p $RemoteDir"

Write-Host "Uploading pulsegrid-agent…"
scp $bin "${target}:${RemoteDir}/pulsegrid-agent"

Write-Host @"

Uploaded. On the Linux host run:

  ssh $target
  cd $RemoteDir
  chmod +x ./pulsegrid-agent
  export SERVER_ID=$ServerId
  export PORT=$Port
  ./pulsegrid-agent

Then point the backend at this agent, e.g.:

  AGENTS=local-01:localhost:50051,${ServerId}:${HostAddress}:${Port}

"@

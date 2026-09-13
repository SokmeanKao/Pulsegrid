# Generate LAN CA + Agent Gateway server certificate (Windows).
param(
  [string]$PublicHost = "localhost",
  [string]$OutDir = "",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $root "certs" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$serverCrt = Join-Path $OutDir "server.crt"
if ((Test-Path $serverCrt) -and -not $Force) {
  Write-Host "Certs already exist in $OutDir (use -Force to regenerate)"
  exit 0
}

$openssl = $null
foreach ($c in @(
  "openssl",
  "C:\Program Files\Git\usr\bin\openssl.exe",
  "C:\ProgramData\chocolatey\bin\openssl.exe"
)) {
  if ($c -eq "openssl") {
    $cmd = Get-Command openssl -ErrorAction SilentlyContinue
    if ($cmd) { $openssl = $cmd.Source; break }
  } elseif (Test-Path $c) { $openssl = $c; break }
}
if (-not $openssl) { throw "openssl is required (install Git for Windows or openssl)" }

Write-Host "Generating CA + server cert for SAN=$PublicHost in $OutDir"

& $openssl genrsa -out (Join-Path $OutDir "ca.key") 4096
& $openssl req -x509 -new -nodes -key (Join-Path $OutDir "ca.key") -sha256 -days 3650 `
  -subj "/CN=Pulsegrid Local CA" -out (Join-Path $OutDir "ca.crt")

& $openssl genrsa -out (Join-Path $OutDir "server.key") 2048
& $openssl req -new -key (Join-Path $OutDir "server.key") -subj "/CN=$PublicHost" `
  -out (Join-Path $OutDir "server.csr")

$san = "subjectAltName=DNS:localhost,IP:127.0.0.1"
if ($PublicHost -match '^\d+\.\d+\.\d+\.\d+$') {
  $san += ",IP:$PublicHost"
} else {
  $san += ",DNS:$PublicHost"
}
$ext = Join-Path $OutDir "san.ext"
"$san`nextendedKeyUsage=serverAuth`n" | Set-Content -Path $ext -Encoding ascii

& $openssl x509 -req -in (Join-Path $OutDir "server.csr") `
  -CA (Join-Path $OutDir "ca.crt") -CAkey (Join-Path $OutDir "ca.key") `
  -CAcreateserial -out $serverCrt -days 825 -sha256 -extfile $ext

Remove-Item (Join-Path $OutDir "server.csr"), (Join-Path $OutDir "ca.srl"), $ext -ErrorAction SilentlyContinue
Write-Host "Wrote $OutDir\{ca.crt,ca.key,server.crt,server.key}"

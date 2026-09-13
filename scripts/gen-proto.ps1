$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$protoc = Join-Path $root ".tools\protoc\bin\protoc.exe"
if (-not (Test-Path $protoc)) {
  $protoc = "protoc"
}
$env:PATH = "$env:USERPROFILE\go\bin;$env:PATH"
New-Item -ItemType Directory -Force -Path "$root\agent\internal\pb" | Out-Null
& $protoc --proto_path="$root\proto" `
  --go_out="$root\agent\internal\pb" --go_opt=paths=source_relative `
  --go-grpc_out="$root\agent\internal\pb" --go-grpc_opt=paths=source_relative `
  "$root\proto\monitoring.proto"
New-Item -ItemType Directory -Force -Path "$root\backend\src\main\proto" | Out-Null
Copy-Item "$root\proto\monitoring.proto" "$root\backend\src\main\proto\monitoring.proto" -Force
Write-Host "Generated Go stubs and synced backend proto."

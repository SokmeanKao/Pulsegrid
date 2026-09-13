# Pulsegrid

Live fleet metrics: Go agents → gRPC → Spring Boot → WebSocket → Next.js + ECharts + shadcn/ui.

**Current status & stack:** [docs/STATUS.md](docs/STATUS.md)

## Layout

- `proto/` — shared `monitoring.proto`
- `agent/` — Go gRPC metrics agent
- `backend/` — Spring Boot fan-out + `/healthz`
- `dashboard/` — Next.js live UI

## Local development

### 1. Agent (`pulsegrid-agent`)

```powershell
.\scripts\build-agent.ps1
.\scripts\run-agent.ps1 -ServerId local-01
```

Or:

```powershell
$env:SERVER_ID="local-01"
$env:PORT="50051"
cd agent
go run ./cmd/pulsegrid-agent
```

Linux (Kali) one-liner (after first release tag exists):

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
  | sudo bash -s -- --server-id kali-01
```

Or build locally and deploy:

```powershell
.\scripts\build-agent.ps1
.\scripts\deploy-agent-linux.ps1 -HostAddress 192.168.150.131 -User kali -ServerId kali-01
```

See [agent/README.md](agent/README.md).

Verify:

```powershell
grpcurl -plaintext -d "{}" localhost:50051 pulsegrid.v1.PulsegridService/HealthCheck
```

### 2. Backend

```powershell
$env:AGENTS="local-01:localhost:50051"
cd backend
.\gradlew.bat bootRun
```

Health: `http://localhost:8080/healthz`  
WS: `ws://localhost:8080/ws/metrics`

### 3. Dashboard

```powershell
cd dashboard
$env:NEXT_PUBLIC_WS_URL="ws://localhost:8080/ws/metrics"
npm run dev
```

Open http://localhost:3000

## Docker Compose

```powershell
docker compose up --build
```

- Dashboard: http://localhost:3000
- Backend health: http://localhost:8080/healthz

## Proto regeneration (Go)

Requires `protoc` and plugins (`protoc-gen-go`, `protoc-gen-go-grpc`):

```powershell
protoc --proto_path=proto `
  --go_out=agent/internal/pb --go_opt=paths=source_relative `
  --go-grpc_out=agent/internal/pb --go-grpc_opt=paths=source_relative `
  proto/monitoring.proto
```

Copy the same file to `backend/src/main/proto/` (Gradle generates Java stubs on build).

## Design / plan

- Spec: `docs/superpowers/specs/2026-09-13-pulsegrid-design.md`
- Plan: `docs/superpowers/plans/2026-09-13-pulsegrid.md`

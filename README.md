# Pulsegrid

Live fleet metrics: **agents on each host** → gRPC → **Monitor** (Spring Boot + Timescale + Next.js).

**Status:** [docs/STATUS.md](docs/STATUS.md)

## Two installables

| Package | What it is | Where it runs |
|---|---|---|
| **Pulsegrid Monitor** | DB + backend + UI | Ops server / your laptop (Docker) |
| **Pulsegrid Agent** | Metrics collector | Each machine you want to watch |

Agents are **not** part of the default Monitor compose.

---

## Install Monitor (one-liner, Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor.sh \
  | sudo bash -s -- --agents "kali-01:192.168.150.131:50051" --public-host YOUR_LAN_IP
```

Windows (repo already cloned, Docker Desktop running):

```powershell
.\scripts\install-monitor.ps1 -Agents "local-01:host.docker.internal:50051"
```

Then open http://localhost:3000 (or `http://YOUR_LAN_IP:3000`).

Optional demo agents inside Compose (container metrics only):

```bash
sudo bash scripts/install-monitor.sh --demo
# or: docker compose --profile demo up -d --build
```

---

## Install Agent (separate, each host)

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
  | sudo bash -s -- --server-id kali-01
```

Windows:

```powershell
.\scripts\run-agent.ps1 -ServerId local-01
```

Point Monitor at agents via `.env` / `--agents`:

```text
AGENTS=kali-01:192.168.150.131:50051,local-01:host.docker.internal:50051
```

See [agent/README.md](agent/README.md).

---

## Layout

- `proto/` — shared `monitoring.proto`
- `agent/` — Go gRPC metrics agent
- `backend/` — Spring Boot fan-out + `/healthz`
- `dashboard/` — Next.js live UI
- `scripts/install-monitor.sh` — Monitor installer
- `scripts/install-agent.sh` — Agent installer

## Local development (without full Monitor install)

### Agent

```powershell
.\scripts\build-agent.ps1
.\scripts\run-agent.ps1 -ServerId local-01
```

### Backend

```powershell
$env:AGENTS="local-01:localhost:50051"
cd backend
.\gradlew.bat bootRun
```

### Dashboard

```powershell
cd dashboard
$env:NEXT_PUBLIC_WS_URL="ws://localhost:8080/ws/metrics"
npm run dev
```

## Docker Compose (Monitor)

```powershell
copy .env.example .env   # set AGENTS=...
docker compose up -d --build
```

- Dashboard: http://localhost:3000  
- Backend: http://localhost:8080/healthz  

## Proto regeneration (Go)

```powershell
protoc --proto_path=proto `
  --go_out=agent/internal/pb --go_opt=paths=source_relative `
  --go-grpc_out=agent/internal/pb --go-grpc_opt=paths=source_relative `
  proto/monitoring.proto
```

## Design / plan

- Spec: `docs/superpowers/specs/2026-09-13-pulsegrid-design.md`
- Agent release: `docs/superpowers/specs/2026-09-13-pulsegrid-agent-release-design.md`

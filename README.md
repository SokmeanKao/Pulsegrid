# Pulsegrid

Live fleet metrics: **agents dial Monitor** over TLS gRPC → Spring Boot + Timescale + Next.js.

**Install guide:** [docs/INSTALL.md](docs/INSTALL.md) · **Status:** [docs/STATUS.md](docs/STATUS.md) · **Latest:** [v2.1.0](https://github.com/SokmeanKao/Pulsegrid/releases/tag/v2.1.0)

![Pulsegrid terminal dashboard](docs/images/dashboard-terminal.png)

## What's new in v2.2.0

- **No-clone Monitor install** — pull `pulsegrid-backend` + `pulsegrid-dashboard` from GHCR
- Dashboard runtime config (works for any `--public-host` without rebuild)
- `docker-compose.monitor.yml` + `install-monitor-images.sh` / `.ps1`

## What's new in v2.1.0

- **Docker** widget — engine status, counts, top containers by CPU/mem
- **Host** widget — uptime + load averages
- **Sensors** widget — NVIDIA GPU + temps when available
- Graceful degrade when Docker/GPU/sensors are absent

## What's new in v2.0.0

**Breaking:** agents initiate the connection. `AGENTS=` and inbound agent `:50051` are gone.

- **Agent Gateway** on Monitor `:50051` (TLS, LAN CA)
- Agents dial Monitor with `--monitor` / `--token` / `--ca`
- **Add Agent** UI generates a join token + install command
- Runtime registry — hosts appear when they connect (no backend restart)
- Reconnect with exponential backoff; registered hosts reconnect without a new token
- Docs/installers rewritten for the agent-initiated model

Also from v1.3.x: terminal dashboard, layout profiles (Compact / Normal / Show More), per-widget fullscreen, themes & locales.

## Two installables

| Package | What it is | Where it runs |
|---|---|---|
| **Pulsegrid Monitor** | DB + backend + UI + **Agent Gateway :50051 (TLS)** | Ops server / your laptop (Docker) |
| **Pulsegrid Agent** | Metrics collector (**dials** Monitor) | Each machine you want to watch |

```text
Agent (outbound TLS) ──► Monitor Gateway :50051 ──► Timescale + WebSocket UI
```

---

## Install Monitor

**No clone (recommended)** — pull published images only:

**Windows** (Docker Desktop; no sudo):

```powershell
irm https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor-images.ps1 -OutFile $env:TEMP\pg-mon.ps1
powershell -ExecutionPolicy Bypass -File $env:TEMP\pg-mon.ps1 -PublicHost YOUR_LAN_IP
```

**Linux / WSL:**

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor-images.sh \
  | bash -s -- --public-host YOUR_LAN_IP
```

**Raw compose only:**

```text
https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/docker-compose.monitor.yml
```

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/docker-compose.monitor.yml -o docker-compose.yml
```

**From source** (clone + build): full walkthrough in **[docs/INSTALL.md](docs/INSTALL.md)**.

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor.sh \
  | sudo bash -s -- --public-host YOUR_LAN_IP
```

Windows (repo cloned):

```powershell
.\scripts\install-monitor.ps1 -PublicHost localhost
```

Opens:

| URL | Purpose |
|---|---|
| `http://YOUR_LAN_IP:3000/terminal` | Dashboard |
| `http://YOUR_LAN_IP:8080/healthz` | Health |
| `YOUR_LAN_IP:50051` | Agent Gateway (TLS) |

Then use **+ Add Agent** in the UI.

---

## Install Agent

```bash
# Copy Monitor certs/ca.crt to the agent host first (or download from UI)
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
  | sudo bash -s -- \
      --server-id kali-01 \
      --monitor YOUR_LAN_IP:50051 \
      --token pg_join_xxxxx \
      --ca /path/to/ca.crt
```

Windows:

```powershell
.\scripts\generate-monitor-certs.ps1 -PublicHost localhost   # on Monitor machine
.\scripts\run-agent.ps1 -ServerId local-01 `
  -Monitor localhost:50051 `
  -Token pg_join_xxxxx `
  -CaFile .\certs\ca.crt
```

See [agent/README.md](agent/README.md).

---

## Layout

- `proto/` — shared `monitoring.proto` (`AgentGateway.Connect`)
- `agent/` — Go agent (gRPC **client**)
- `backend/` — Spring Boot gateway + WS fan-out
- `dashboard/` — Next.js live UI
- `certs/` — generated locally (gitignored); CA + gateway server cert
- `scripts/install-monitor.sh` / `install-agent.sh` — installers

## Local development

```powershell
.\scripts\generate-monitor-certs.ps1 -PublicHost localhost
copy .env.example .env
docker compose up -d --build
```

Agent (separate terminal):

```powershell
.\scripts\build-agent.ps1
# Enroll via UI or: POST http://localhost:8080/api/agents/enroll
.\scripts\run-agent.ps1 -ServerId local-01 -Monitor localhost:50051 -Token pg_join_... -CaFile .\certs\ca.crt
```

Dashboard only:

```powershell
cd dashboard
$env:NEXT_PUBLIC_WS_URL="ws://localhost:8080/ws/metrics"
$env:NEXT_PUBLIC_API_URL="http://localhost:8080"
npm run dev
```

## Proto regeneration (Go)

```powershell
protoc --proto_path=proto `
  --go_out=agent/internal/pb --go_opt=paths=source_relative `
  --go-grpc_out=agent/internal/pb --go-grpc_opt=paths=source_relative `
  proto/monitoring.proto
```

## Design / plan

- **v2.0 gateway:** `docs/superpowers/specs/2026-09-14-pulsegrid-agent-initiated-gateway-design.md`
- **Plan:** `docs/superpowers/plans/2026-09-14-pulsegrid-agent-initiated-gateway.md`

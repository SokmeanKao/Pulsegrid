# Pulsegrid — Implementation Status & Stack

**Last updated:** 2026-09-13

**Install:** [INSTALL.md](./INSTALL.md) · **Monitor:** [MONITOR.md](./MONITOR.md)

## Architecture

```
Go agent (per host)  --gRPC StreamMetrics (~2s)-->  Spring Boot backend
                                                      |
                                              /ws/metrics (JSON)
                                                      |
                                         Next.js dashboard (ECharts + shadcn)
```

Single contract: `proto/monitoring.proto` → Go stubs (`agent/internal/pb`) + Java stubs (Gradle protobuf plugin).

---

## Stack

| Layer | Tech |
|---|---|
| **Agent** | Go 1.22, gRPC, protobuf, gopsutil/v3, reflection for grpcurl |
| **Backend** | Java 21, Spring Boot 4.0, WebSocket, Reactor `Sinks.Many`, gRPC client (stub + netty-shaded), Jackson 3 |
| **Dashboard** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Card, Badge, Progress, ScrollArea, Separator), lucide-react, ECharts, Maven Pro |
| **Ops** | Docker Compose (multi-agent fleet), Dockerfiles per service |
| **Contract** | Protocol Buffers 3 (`PulsegridService`: GetMetrics, StreamMetrics, HealthCheck) |

### Env / config

| Var | Where | Purpose |
|---|---|---|
| `SERVER_ID` | Agent | Required; labels every metrics sample |
| `PORT` | Agent | gRPC listen (default `50051`) |
| `AGENTS` | Backend | `name:host:port,...` registry |
| `NEXT_PUBLIC_WS_URL` | Dashboard | Browser WebSocket URL (default `ws://localhost:8080/ws/metrics`) |

---

## Implementation status

### Done

| Area | Status | Notes |
|---|---|---|
| Proto contract | Done | Shared file; Go generated; backend copy + Gradle codegen |
| Go agent | Done | Collect CPU/mem/disk/net; stream every 2s; `SERVER_ID` required; Dockerfile |
| Agent verify | Done (local) | grpcurl HealthCheck + GetMetrics |
| Spring Boot backend | Done | Registry, AgentClient reconnect/backoff, WS fan-out, `/healthz` |
| Backend verify | Done (local) | healthz shows agent connected; WS JSON frames received |
| Next.js dashboard | Done | Real WS hook (ref ring buffer), reconnect + disconnected UI |
| Dashboard UI | Done | shadcn sidebar + detail cards, metric tiles, ECharts trend, disk Progress |
| Dashboard build | Done | `npm run build` passes |
| Docker Compose file | Done | `agent-web-01`, `agent-db-01`, `backend`, `dashboard` |
| Docs | Done | Spec, plan, README |

### Partial / in progress

| Area | Status | Notes |
|---|---|---|
| Docker Compose bring-up | Partial | Backend base image fixed (`temurin:*-jammy`); full `compose up --build` should be re-run after UI changes to refresh dashboard image |
| Proto tooling on PATH | Local helper | `.tools/protoc` + `scripts/gen-proto.ps1` (protoc not assumed globally) |

### Not in v1 (by design)

- Auth on WebSocket / `/healthz`
- DB-backed server registry
- Alert / threshold logic
- Network rate derivation on the agent (cumulative counters only)
- Production observability (metrics of the monitor itself)

---

## Milestone checklist

1. [x] Proto compiles; stubs for Go and Java
2. [x] Agent serves live metrics over gRPC
3. [x] Backend relays over WebSocket
4. [x] Dashboard shows real live data (local e2e)
5. [ ] `docker compose up --build` verified end-to-end from clean checkout (re-verify after latest UI)

---

## Pulsegrid v2 (planned)

Product direction: **Observe → Detect → Investigate** on top of the v1 live pipeline (not a rewrite).

| Phase | Theme | Status |
|---|---|---|
| v2.1 | Monitoring foundation (proto, rates, health, WS subscriptions, Timescale, registry) | **Done** (Compose verified 2026-09-13) |
| v2.2 | Product UI (Overview, Servers, Detail, Agents, history) | Not started |
| v2.3 | Alerts & events | Not started |
| v2.4 | Auth, TLS, notifications, HA | Not started |

**Design:** [docs/superpowers/specs/2026-09-13-pulsegrid-v2-design.md](./superpowers/specs/2026-09-13-pulsegrid-v2-design.md)  
**Plan:** [docs/superpowers/plans/2026-09-13-pulsegrid-v2.1.md](./superpowers/plans/2026-09-13-pulsegrid-v2.1.md)  
**Terminal View:** [docs/superpowers/specs/2026-09-13-pulsegrid-terminal-view-design.md](./superpowers/specs/2026-09-13-pulsegrid-terminal-view-design.md)  
**Terminal console UX:** [docs/superpowers/specs/2026-09-13-pulsegrid-terminal-console-ux.md](./superpowers/specs/2026-09-13-pulsegrid-terminal-console-ux.md) (canvas GridStack + VIEW/EDIT)

### v2.1 checklist

- [x] `MetricsEnvelope` proto (sequence, collected_at, host/agent/cpu/mem/disks/networks/processes)
- [x] Agent-side network/disk rates + top processes
- [x] LiveStateCache health model (HEALTHY/WARNING/CRITICAL/OFFLINE)
- [x] Timescale schema + history writer + `GET /api/servers/{id}/metrics`
- [x] DB registry with `AGENTS` bootstrap + `POST /api/servers`
- [x] Scoped WS subscribe (`mode: all` or `servers: []`)
- [x] Dashboard consumes envelope + sends subscribe
- [x] Docker Compose e2e with `db` service verified
- [x] Per-core CPU (`cpu.perCorePercent`) in agent v1.2.0 + proto/backend/dashboard types
- [x] Terminal View TV-1 at `/terminal` (GUI|TUI toggle, host list, CPU/mem/disk/net/processes panels)

---

## Repo map

```
pulsegrid/
├── proto/monitoring.proto
├── agent/                 # Go gRPC agent
├── backend/               # Spring Boot
├── dashboard/             # Next.js + shadcn + ECharts
├── docker-compose.yml
├── scripts/gen-proto.ps1
├── docs/superpowers/specs/2026-09-13-pulsegrid-design.md
├── docs/superpowers/plans/2026-09-13-pulsegrid.md
└── README.md              # run instructions
```

## Quick local e2e

### Monitor (DB + backend + UI)

```powershell
.\scripts\install-monitor.ps1 -Agents "local-01:host.docker.internal:50051"
# or: docker compose up -d --build
```

Linux one-liner: `scripts/install-monitor.sh` — see [MONITOR.md](./MONITOR.md).

### Agent (separate host / process)

```powershell
.\scripts\run-agent.ps1 -ServerId local-01
```

Linux: `scripts/install-agent.sh --server-id kali-01`  
Build: `.\scripts\build-agent.ps1` → `agent/dist/`  
Deploy Kali: `.\scripts\deploy-agent-linux.ps1 -HostAddress 192.168.150.131 -User kali -ServerId kali-01`  
See [agent/README.md](../agent/README.md).

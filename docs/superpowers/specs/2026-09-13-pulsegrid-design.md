# Pulsegrid — Design Spec

**Date:** 2026-09-13  
**Status:** Approved for implementation planning  
**Approach:** Backend pulls gRPC streams from agents; fans out over WebSocket to Next.js dashboard

## Goal

Build a three-part monorepo monitoring stack that shows live per-server system metrics in a browser:

```
Go agent (per server) --gRPC stream--> Spring Boot backend --WebSocket (JSON)--> Next.js dashboard
```

## Decisions locked

| Decision | Choice |
|---|---|
| Architecture | Backend-initiated gRPC `StreamMetrics` to each agent; WS fan-out |
| Charts | Apache ECharts with imperative `setOption` |
| Agent identity | `SERVER_ID` environment variable |
| Auth (v1) | Open WebSocket and `/healthz` (no auth); defer to later |
| Agent network metrics | Cumulative `bytes_sent` / `bytes_recv` (rates optional later on dashboard) |
| Registry | In-memory map from `AGENTS` env var |

## Out of scope (v1)

- Authentication / authorization
- DB-backed server registry
- Thresholds, alerting, or business logic on the agent
- Network rate derivation on the agent
- Production hardening beyond reconnect/backoff and health reporting

## Monorepo layout

```
pulsegrid/
├── proto/
│   └── monitoring.proto          # single source of truth
├── agent/                        # Go
│   ├── cmd/agent/main.go
│   ├── internal/metrics/collector.go
│   ├── internal/server/grpc_server.go
│   ├── internal/pb/              # generated
│   ├── go.mod
│   └── Dockerfile
├── backend/                      # Spring Boot (Gradle)
│   ├── src/main/java/com/monitoring/backend/
│   │   ├── BackendApplication.java
│   │   ├── grpc/AgentClient.java
│   │   ├── ws/MetricsWebSocketHandler.java
│   │   ├── registry/ServerRegistry.java
│   │   ├── health/HealthController.java
│   │   └── config/WebSocketConfig.java
│   ├── src/main/proto/monitoring.proto
│   ├── build.gradle
│   └── Dockerfile
├── dashboard/                    # Next.js (App Router, TypeScript)
│   ├── app/
│   ├── components/ServerCard.tsx
│   ├── lib/useMetricsSocket.ts
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

`proto/monitoring.proto` is the only hand-maintained contract. Both agent and backend regenerate stubs from it; never diverge.

## Architecture & data flow

1. Each Go agent listens on gRPC (`PORT`, default `50051`) and labels samples with `SERVER_ID`.
2. On backend startup, `ServerRegistry` parses `AGENTS=name:host:port,...`.
3. `AgentClient` opens `StreamMetrics` to every registered agent. Messages publish to an internal multicast sink (Reactor `Sinks.Many`).
4. `MetricsWebSocketHandler` at `/ws/metrics` registers sessions and broadcasts each metric as JSON `TextMessage`.
5. Dashboard opens one WebSocket, buffers points per `serverId` in a ref, updates ECharts imperatively.

Resilience:

- One agent offline → reconnect that stream with exponential backoff; other agents and WS continue.
- WebSocket client drop → remove session; do not fail broadcasts for remaining sessions.
- Dashboard disconnect → reconnect with backoff; show explicit disconnected state (do not silently present stale data as live).

## Proto contract

Service: `PulsegridService`

| RPC | Signature |
|---|---|
| `GetMetrics` | `MetricsRequest` → `MetricsResponse` |
| `StreamMetrics` | `MetricsRequest` → stream `MetricsResponse` |
| `HealthCheck` | `HealthRequest` → `HealthResponse` |

`MetricsRequest` and `HealthRequest` are empty messages in v1 (placeholders for future filters).

### MetricsResponse

| Proto field | JSON (WS) | Notes |
|---|---|---|
| `server_id` | `serverId` | From `SERVER_ID` |
| `cpu_usage_percent` | `cpuUsagePercent` | 0–100 |
| `memory_used_mb` | `memoryUsedMb` | |
| `memory_total_mb` | `memoryTotalMb` | |
| `disk_used_gb` | `diskUsedGb` | |
| `disk_total_gb` | `diskTotalGb` | |
| `network` | `network` | Repeated `NetworkStat` |
| `timestamp` | `timestamp` | Unix millis |

### NetworkStat

- `interface_name` → `interfaceName`
- `bytes_sent` → `bytesSent`
- `bytes_recv` → `bytesRecv`

### HealthResponse

- `status`: `OK` | `NOT_READY`
- `message`: optional string

WebSocket payload: one JSON object per tick matching the MetricsResponse JSON shape above. No envelope wrapper in v1.

## Go agent

Responsibilities:

- Collect CPU, memory, disk, and network via `gopsutil/v3`.
- Serve gRPC `PulsegridService` with `StreamMetrics` on a 2s `time.Ticker` until client cancel.
- No thresholds or alerting.

Environment:

| Var | Required | Default | Purpose |
|---|---|---|---|
| `SERVER_ID` | Yes | — | Value of `server_id` in every response; agent exits on startup if unset/empty |
| `PORT` | No | `50051` | gRPC listen port |

Local smoke without Compose: export `SERVER_ID` (e.g. `export SERVER_ID=local-01`) before starting the agent.

Verification: `grpcurl` `HealthCheck` and stream `StreamMetrics` before Phase 3.

## Spring Boot backend

Dependencies (conceptually): `spring-boot-starter-web`, `spring-boot-starter-websocket`, `net.devh:grpc-client-spring-boot-starter` (or equivalent manual stubs + channels), `grpc-stub`, `grpc-protobuf`, Reactor for `Sinks.Many`, protobuf Gradle plugin.

Components:

- **ServerRegistry** — in-memory `name → host:port` from `AGENTS`.
- **AgentClient** — supervised stream per agent; publish to sink; backoff reconnect (e.g. 1s → 30s cap).
- **MetricsWebSocketHandler** — session registry + JSON broadcast.
- **WebSocketConfig** — register handler at `/ws/metrics`.
- **HealthController** — `GET /healthz` returns 200 when process is up; body includes per-agent connected/disconnected status for operators.

Verification: run against Phase 2 agent; `wscat -c ws://localhost:8080/ws/metrics` sees JSON ~every 2s.

## Next.js dashboard

- `useMetricsSocket`: `WebSocket` to `NEXT_PUBLIC_WS_URL`; parse JSON; maintain `Map<serverId, ringBuffer>` in a **ref** (last N ≈ 60); React state only for connection status (`connected` | `reconnecting` | `disconnected`).
- `ServerCard`: CPU/mem/disk gauges + time series via ECharts `setOption`.
- `page.tsx`: grid of cards for servers seen on the wire; empty state until first message; disconnected banner when socket is down.
- Happy path uses real backend data only (no simulated metrics for the primary demo path).

Verification: `npm run dev` against live backend + agent.

## Docker Compose

```yaml
services:
  agent-web-01:
    build: ./agent
    environment:
      - PORT=50051
      - SERVER_ID=web-01
  agent-db-01:
    build: ./agent
    environment:
      - PORT=50052
      - SERVER_ID=db-01
  backend:
    build: ./backend
    environment:
      - AGENTS=web-01:agent-web-01:50051,db-01:agent-db-01:50052
    ports: ["8080:8080"]
    depends_on: [agent-web-01, agent-db-01]
  dashboard:
    build: ./dashboard
    environment:
      - NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws/metrics
    ports: ["3000:3000"]
    depends_on: [backend]
```

Note: browser connects to `localhost:8080` from the host; that matches published backend ports.

## Testing at phase boundaries

1. Proto compiles; Go and Java stubs generate cleanly.
2. Agent gRPC test (`grpcurl` or Go test client).
3. Backend WebSocket test (test client or `wscat`).
4. Dashboard smoke test with mocked socket.
5. `docker-compose up` from a clean checkout brings the fleet up.

## Success milestones

1. Proto compiles; stubs generate for Go and Java.
2. Go agent serves live metrics over gRPC (`grpcurl`).
3. Backend relays metrics over WebSocket (`wscat`).
4. Dashboard shows real live data end to end.
5. `docker-compose up` works from clean checkout.

## Build order

Implement and verify in sequence: Phase 1 proto → Phase 2 agent → Phase 3 backend → Phase 4 dashboard → Phase 5 Compose. Do not skip ahead without the prior phase’s verification gate.

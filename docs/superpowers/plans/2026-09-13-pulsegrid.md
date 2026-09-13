# Pulsegrid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working monorepo where Go agents stream metrics over gRPC to a Spring Boot backend that fans out JSON over WebSocket to a Next.js + ECharts dashboard, runnable via Docker Compose.

**Architecture:** Backend opens outbound `StreamMetrics` to each agent listed in `AGENTS`; publishes to Reactor `Sinks.Many`; WebSocket `/ws/metrics` broadcasts camelCase JSON; dashboard buffers in a ref and updates ECharts via `setOption`.

**Tech Stack:** Go 1.22+, gopsutil v3, gRPC; Java 21, Spring Boot 3.x, WebSocket, protobuf-gradle-plugin; Next.js App Router, TypeScript, ECharts; Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-13-pulsegrid-design.md`

## Global Constraints

- Single proto source: `proto/monitoring.proto` (copy into backend `src/main/proto/`).
- Agent: no thresholds/alerting; set `server_id` from `SERVER_ID`; exit if unset.
- Backend: tolerate offline agents with backoff; keep other streams + WS alive.
- Dashboard: reconnect with backoff; show disconnected state; no simulated happy-path data.
- Auth open in v1. Charts: ECharts. WS JSON: camelCase field names as in spec.
- Commits optional until user asks (repo may be uninitialized).

## File structure

| Path | Responsibility |
|---|---|
| `proto/monitoring.proto` | Contract |
| `agent/cmd/agent/main.go` | Process entry, env, gRPC listen |
| `agent/internal/metrics/collector.go` | gopsutil → MetricsResponse |
| `agent/internal/server/grpc_server.go` | PulsegridServiceServer |
| `agent/internal/pb/*` | Generated Go stubs |
| `backend/.../registry/ServerRegistry.java` | Parse AGENTS map |
| `backend/.../grpc/AgentClient.java` | Streams + reconnect + sink |
| `backend/.../ws/MetricsWebSocketHandler.java` | Session fan-out |
| `backend/.../config/WebSocketConfig.java` | `/ws/metrics` |
| `backend/.../health/HealthController.java` | `/healthz` |
| `dashboard/lib/useMetricsSocket.ts` | WS + ref buffer + status |
| `dashboard/components/ServerCard.tsx` | ECharts gauges + series |
| `dashboard/app/page.tsx` | Grid + provider |
| `docker-compose.yml` | Fleet |

---

### Task 1: Proto contract + generation toolchain

**Files:**
- Create: `proto/monitoring.proto`
- Create: `scripts/gen-proto.sh` (or PowerShell `scripts/gen-proto.ps1`) for Go generation
- Create: `README.md` (minimal: how to generate + run)

**Interfaces:**
- Produces: `PulsegridService` with GetMetrics, StreamMetrics, HealthCheck; messages as in spec

- [ ] **Step 1: Write `proto/monitoring.proto`**

```protobuf
syntax = "proto3";

package pulsegrid.v1;

option go_package = "github.com/pulsegrid/agent/internal/pb";
option java_multiple_files = true;
option java_package = "com.monitoring.backend.grpc.gen";
option java_outer_classname = "MonitoringProto";

service PulsegridService {
  rpc GetMetrics(MetricsRequest) returns (MetricsResponse);
  rpc StreamMetrics(MetricsRequest) returns (stream MetricsResponse);
  rpc HealthCheck(HealthRequest) returns (HealthResponse);
}

message MetricsRequest {}
message HealthRequest {}

message NetworkStat {
  string interface_name = 1;
  uint64 bytes_sent = 2;
  uint64 bytes_recv = 3;
}

message MetricsResponse {
  string server_id = 1;
  double cpu_usage_percent = 2;
  double memory_used_mb = 3;
  double memory_total_mb = 4;
  double disk_used_gb = 5;
  double disk_total_gb = 6;
  repeated NetworkStat network = 7;
  int64 timestamp = 8;
}

message HealthResponse {
  string status = 1;   // OK | NOT_READY
  string message = 2;
}
```

- [ ] **Step 2: Ensure `protoc` + Go plugins available**

Install `protoc` if missing (winget/choco/scoop or GitHub release). Then:

```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
```

- [ ] **Step 3: Generate Go stubs into `agent/internal/pb`**

```bash
mkdir -p agent/internal/pb
protoc --proto_path=proto \
  --go_out=agent/internal/pb --go_opt=paths=source_relative \
  --go-grpc_out=agent/internal/pb --go-grpc_opt=paths=source_relative \
  proto/monitoring.proto
```

Expected: `monitoring.pb.go` and `monitoring_grpc.pb.go` exist.

- [ ] **Step 4: Verify** — files non-empty; no protoc errors.

---

### Task 2: Go agent — collector + gRPC server

**Files:**
- Create: `agent/go.mod`
- Create: `agent/internal/metrics/collector.go`
- Create: `agent/internal/server/grpc_server.go`
- Create: `agent/cmd/agent/main.go`
- Create: `agent/Dockerfile`
- Test: `agent/internal/metrics/collector_test.go` (smoke: Collect returns non-empty server_id when set)

**Interfaces:**
- Consumes: generated `pb.MetricsResponse`, `pb.PulsegridServiceServer`
- Produces: `metrics.Collect(ctx, serverID string) (*pb.MetricsResponse, error)`; gRPC on `PORT`

- [ ] **Step 1: `go mod init github.com/pulsegrid/agent`** and require grpc, protobuf, gopsutil/v3

- [ ] **Step 2: Implement collector** — CPU percent (gopsutil), virtual memory MB, disk usage on `/` or `C:\`, network IO counters per interface, `timestamp = time.Now().UnixMilli()`, `server_id = serverID`.

- [ ] **Step 3: Implement `grpc_server.go`** — embed `UnimplementedPulsegridServiceServer`; `GetMetrics` one-shot Collect; `StreamMetrics` ticker 2s; `HealthCheck` returns status `OK`.

- [ ] **Step 4: `main.go`** — read `SERVER_ID` (fatal if empty), `PORT` default 50051; listen TCP; register service; log startup.

- [ ] **Step 5: Verify** — `SERVER_ID=local-01 go run ./cmd/agent` then grpcurl HealthCheck / StreamMetrics (or Go test client if grpcurl missing).

- [ ] **Step 6: Dockerfile** multi-stage build exposing PORT.

---

### Task 3: Spring Boot backend

**Files:**
- Create full Gradle Spring Boot project under `backend/`
- Copy proto to `backend/src/main/proto/monitoring.proto`
- Create Java classes listed in file structure
- Create: `backend/Dockerfile`
- Test: WebSocket integration test or documented wscat verification

**Interfaces:**
- Consumes: `AGENTS=name:host:port,...`
- Produces: WS JSON camelCase MetricsResponse; `GET /healthz`

- [ ] **Step 1: Scaffold Gradle Spring Boot 3.3+/3.4 with Java 21**, deps: web, websocket, reactor-core, grpc-stub, grpc-protobuf, grpc-netty-shaded, protobuf-java, jackson; configure `com.google.protobuf` + `grpc` codegen.

- [ ] **Step 2: Copy proto; `./gradlew generateProto`**

- [ ] **Step 3: `ServerRegistry`** parse AGENTS into ConcurrentHashMap.

- [ ] **Step 4: `MetricsHub`** with `Sinks.Many<MetricsDto>` multicast; DTO mirrors JSON fields.

- [ ] **Step 5: `AgentClient`** ManagedChannel per agent; async StreamMetrics observer; onNext → hub; onError/onCompleted → schedule reconnect with backoff 1s→30s.

- [ ] **Step 6: `MetricsWebSocketHandler` + `WebSocketConfig` at `/ws/metrics`.

- [ ] **Step 7: `HealthController` `/healthz` JSON `{ "status":"UP", "agents": { "web-01":"connected", ... } }`.

- [ ] **Step 8: Verify** against running agent with wscat or Java WS client test.

---

### Task 4: Next.js dashboard

**Files:**
- Create: `dashboard/` via create-next-app (TS, App Router, no unnecessary extras)
- Create: `dashboard/lib/types.ts`, `useMetricsSocket.ts`, `MetricsProvider.tsx`
- Create: `dashboard/components/ServerCard.tsx`
- Create: `dashboard/app/page.tsx`, layout styles
- Create: `dashboard/Dockerfile`
- Test: smoke test mocking WebSocket

**Interfaces:**
- Consumes: `NEXT_PUBLIC_WS_URL` (default `ws://localhost:8080/ws/metrics`)
- Produces: live ServerCard grid

- [ ] **Step 1: Scaffold Next.js app**

- [ ] **Step 2: `useMetricsSocket`** — ref ring buffer N=60; status state; reconnect backoff

- [ ] **Step 3: `ServerCard`** — echarts-for-react or raw echarts init + setOption on buffer changes via rAF/interval poll of ref

- [ ] **Step 4: Page grid + disconnected banner**

- [ ] **Step 5: Verify** against live backend

---

### Task 5: Docker Compose + README

**Files:**
- Create: `docker-compose.yml`
- Update: `README.md` with run instructions

- [ ] **Step 1: Compose** services agent-web-01, agent-db-01, backend, dashboard per spec (`SERVER_ID` set; AGENTS string; ports 8080/3000)

- [ ] **Step 2: `docker compose up --build`** verify healthz + dashboard

- [ ] **Step 3: README** — local run order + Compose

---

## Execution notes

- Prefer installing `protoc` and `grpcurl` for verification; fall back to Go/Java test clients.
- On Windows, use PowerShell-friendly commands; path separators as needed.
- Skip git commits unless user requests (no repo yet).

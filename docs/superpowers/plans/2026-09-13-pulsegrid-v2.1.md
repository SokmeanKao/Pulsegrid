# Pulsegrid v2.1 — Monitoring Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the v1 live pipeline with a richer metrics envelope (timestamp, sequence, host/agent meta, rates, multi-disk, top processes), DB-backed registry + Timescale history, health/connection state model, and scoped WebSocket subscriptions — without rewriting the agent→gRPC→backend→WS path.

**Architecture:** Agent computes rates and emits `MetricsEnvelope` over existing gRPC RPCs. Backend ingests into a live cache, writes raw samples to TimescaleDB, evaluates simple health from latest sample + last-seen, and brokers WS by subscription. REST exposes registry + recent history. Dashboard keeps working against new JSON shape (minimal UI; full product UI is v2.2).

**Tech Stack:** Go agent + gopsutil; Spring Boot 4 + JDBC + Flyway; PostgreSQL 16 + TimescaleDB; Next.js types/WS updates; Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-13-pulsegrid-v2-design.md`

## Global Constraints

- Keep LIVE vs HISTORICAL separation: WS = live only; history via REST.
- Derive network/disk rates in the agent.
- Connection state ≠ health state (CONNECTED/DISCONNECTED vs HEALTHY/WARNING/CRITICAL/OFFLINE/UNKNOWN).
- Single proto source: `proto/monitoring.proto` → regenerate Go + copy to backend.
- Commits only when user asks.
- Auth / alerts engine / full nav IA are out of scope for v2.1 (alerts = v2.3; Overview UI = v2.2).

## File map

| Path | Responsibility |
|---|---|
| `proto/monitoring.proto` | MetricsEnvelope + nested messages |
| `agent/internal/metrics/*` | Collect + rate derivation + sequence |
| `agent/internal/server/grpc_server.go` | Serve envelope |
| `backend/.../dto/*` | JSON DTOs matching envelope |
| `backend/.../live/LiveStateCache.java` | Latest sample + lastSeen per server |
| `backend/.../registry/*` | DB registry (+ env bootstrap) |
| `backend/.../history/*` | Timescale writer + REST |
| `backend/.../ws/*` | Subscribe protocol |
| `backend/.../health/*` | Health derivation + /healthz |
| `dashboard/lib/types.ts` + WS hook | Consume new payload / subscribe |
| `docker-compose.yml` | Add `db` (timescale) |

---

### Task 1: Proto — MetricsEnvelope

**Files:**
- Modify: `proto/monitoring.proto`
- Regenerate: `agent/internal/pb/*`, `backend/src/main/proto/monitoring.proto`

**Interfaces:**
- Produces: `StreamMetrics` / `GetMetrics` return `MetricsEnvelope`
- Fields: `server_id`, `collected_at_unix_ms`, `sequence`, `host`, `cpu`, `memory`, `disks[]`, `networks[]`, `top_processes[]`, `agent`

- [ ] **Step 1:** Replace flat `MetricsResponse` with envelope + nested messages (keep old message names only if needed for one release — prefer clean cut in monorepo).

- [ ] **Step 2:** Run `scripts/gen-proto.ps1` (or equivalent) and `./gradlew generateProto`.

- [ ] **Step 3:** Verify Go + Java stubs compile.

**Nested messages (required):**

```protobuf
message HostInfo {
  string hostname = 1;
  string os = 2;
  string arch = 3;
  string platform = 4; // e.g. windows, linux
}

message AgentInfo {
  string version = 1;
  string go_version = 2;
  int64 started_at_unix_ms = 3;
  uint64 samples_sent = 4;
}

message CpuMetrics {
  double usage_percent = 1;
  uint32 logical_cores = 2;
  double load1 = 3;
  double load5 = 4;
  double load15 = 5;
}

message MemoryMetrics {
  double total_mb = 1;
  double used_mb = 2;
  double available_mb = 3;
  double cached_mb = 4;
  double swap_total_mb = 5;
  double swap_used_mb = 6;
}

message DiskMetrics {
  string mount = 1;
  string device = 2;
  double used_gb = 3;
  double total_gb = 4;
  double read_bytes_per_sec = 5;
  double write_bytes_per_sec = 6;
  double read_ops_per_sec = 7;
  double write_ops_per_sec = 8;
}

message NetworkMetrics {
  string interface_name = 1;
  double rx_bytes_per_sec = 2;
  double tx_bytes_per_sec = 3;
  double rx_packets_per_sec = 4;
  double tx_packets_per_sec = 5;
  uint64 rx_errors = 6;
  uint64 tx_errors = 7;
  uint64 rx_dropped = 8;
  uint64 tx_dropped = 9;
  uint64 rx_bytes_total = 10; // optional debug counters
  uint64 tx_bytes_total = 11;
}

message ProcessMetrics {
  int32 pid = 1;
  string name = 2;
  double cpu_percent = 3;
  double memory_mb = 4;
}
```

---

### Task 2: Agent — rates, meta, top processes

**Files:**
- Modify: `agent/internal/metrics/collector.go`
- Create: `agent/internal/metrics/rates.go` (previous sample state)
- Modify: `agent/cmd/agent/main.go` (AGENT_VERSION const)
- Test: rate unit tests with fake previous counters

- [ ] **Step 1:** Maintain last IO counters; on each Collect compute per-second rates using elapsed wall time.
- [ ] **Step 2:** Fill HostInfo (hostname, GOOS, GOARCH), AgentInfo, CpuMetrics (Percent + Counts + LoadAvg where available; Windows load may be 0).
- [ ] **Step 3:** Memory: Total/Used/Available/Cached/Swap via gopsutil.
- [ ] **Step 4:** Disks: all partitions (or filter sensible mounts); IOCounters for rates.
- [ ] **Step 5:** Top processes: top 10 CPU + top 10 memory (dedupe by PID), cap list ≤ 20.
- [ ] **Step 6:** Monotonic `sequence` + `collected_at_unix_ms`.
- [ ] **Step 7:** `go test ./...` and grpcurl GetMetrics shows rates + sequence.

---

### Task 3: Backend — live cache, health model, DTO

**Files:**
- Replace/extend: `MetricsMessage.java` → envelope DTO
- Create: `LiveStateCache.java`
- Modify: `AgentClient.java`, `MetricsHub.java`, `/healthz`

Health derivation (v2.1 simple rules):
- OFFLINE if lastSeen > 30s
- CRITICAL if CPU≥95 or any disk≥95 or mem used/total≥95
- WARNING if CPU≥80 or disk≥80 or mem≥85
- else HEALTHY if CONNECTED
- UNKNOWN if never seen

- [ ] **Step 1:** Map envelope → JSON DTO (camelCase).
- [ ] **Step 2:** On each sample update LiveStateCache (connection CONNECTED, lastSeen, health).
- [ ] **Step 3:** Expose connection+health on `/healthz` and `/api/servers` (minimal list).

---

### Task 4: TimescaleDB + history writer + REST

**Files:**
- Create: Flyway migrations under `backend/src/main/resources/db/migration`
- Create: `HistoryWriter`, `HistoryController`
- Modify: `docker-compose.yml` (timescaledb), `application.properties`
- Tables: `servers`, `metric_samples` (hypertable on time), optional JSONB payload column for v2.1 speed

- [ ] **Step 1:** Compose service `db` image `timescale/timescaledb:latest-pg16`, env POSTGRES_*.
- [ ] **Step 2:** Migration: servers registry + metric_samples hypertable.
- [ ] **Step 3:** Async write each ingested sample (raw).
- [ ] **Step 4:** `GET /api/servers/{id}/metrics?from=&to=` returns points (limit/downsample later).
- [ ] **Step 5:** Verify insert + query with curl after local agent stream.

---

### Task 5: DB-backed registry + env bootstrap

**Files:**
- Replace in-memory-only `ServerRegistry` with JPA/JdbcTemplate repository
- Seed from `AGENTS` on startup if DB empty
- REST: `GET/POST /api/servers`

- [ ] **Step 1:** Persist name, grpc_host, grpc_port, tags (text/json), status fields.
- [ ] **Step 2:** AgentClient connects from DB list; refresh on add (or restart for v2.1).
- [ ] **Step 3:** POST add server works; Compose still uses AGENTS seed.

---

### Task 6: Scoped WebSocket subscriptions

**Files:**
- Modify: `MetricsWebSocketHandler.java`
- Protocol: client → `{"type":"subscribe","servers":["web-01"]}` or `{"type":"subscribe","mode":"all"}` for small fleets
- Only fan-out matching servers to that session

- [ ] **Step 1:** Per-session subscription set (default empty until subscribe; or default `all` for backward compat during migrate — prefer require subscribe, dashboard sends `all` or selected ids).
- [ ] **Step 2:** Ignore/broadcast filter.
- [ ] **Step 3:** Integration test: two sessions different filters.

---

### Task 7: Dashboard — consume envelope + subscribe

**Files:**
- Modify: `lib/types.ts`, `useMetricsSocket.tsx`, `ServerCard.tsx`, `page.tsx`
- Map CPU/mem/disk from nested fields; network show Mbps from rates
- On open: send subscribe `all` or known server list

- [ ] **Step 1:** Types for envelope.
- [ ] **Step 2:** Subscribe on open; reconnect re-subscribes.
- [ ] **Step 3:** UI still works end-to-end (no full v2.2 nav yet).
- [ ] **Step 4:** `npm run build`.

---

### Task 8: Compose verification + STATUS

- [ ] **Step 1:** `docker compose up --build` with db + 2 agents + backend + dashboard.
- [ ] **Step 2:** healthz, WS subscribe, REST history sample.
- [ ] **Step 3:** Update `docs/STATUS.md` v2.1 → Done / Partial.

---

## Out of scope reminders

Full Overview/Servers IA, alert evaluator, TanStack Query app-wide, auth, rollup continuous aggregates (can add basic raw retention only in v2.1).

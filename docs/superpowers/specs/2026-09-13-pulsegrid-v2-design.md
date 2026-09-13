# Pulsegrid v2 — Product & Architecture Design

**Date:** 2026-09-13  
**Status:** Draft for review  
**Relationship to v1:** Keep the existing real-time telemetry pipeline. Build v2 *around* it; do not replace the agent → gRPC → backend → WebSocket path.

**Spec:** This document captures the v2 product boundary: **Observe → Detect → Investigate**. Act (remote shell, kill, reboot, auto-remediation, K8s, logs, APM) is explicitly out of scope for v2.

---

## 1. Target architecture

```text
Monitored Host
  Go Agent (CPU, mem, disk, net rates, processes, host meta, agent health)
       │ gRPC StreamMetrics
       ▼
Spring Boot Backend
  Agent Registry · Ingestion · Live State Cache · History Writer
  Alert Evaluator · Event Service
       │                    │
  Live WS Broker       Historical Storage (PostgreSQL + TimescaleDB)
       │                    │
  WebSocket            REST API
       └────────┬───────────┘
                ▼
         Next.js Dashboard
  Overview · Servers · Detail · Alerts · Events · Agents · Settings
```

### Critical separation

| Path | Flow | Used for |
|---|---|---|
| **LIVE** | Agent → Backend → WebSocket → Browser | Live tiles, LIVE range, connection status |
| **HISTORICAL** | Agent → Backend → Storage → REST → Browser | 5m–30d charts, events history, alert history |

Do **not** retrieve historical charts through the live WebSocket stream.

---

## 2. Information architecture

### Nav

```text
PULSEGRID
MONITOR    Overview · Servers · Alerts · Events
MANAGE     Agents
SYSTEM     Settings
```

### Routes

```text
/overview
/servers
/servers/[serverId]/overview|cpu|memory|disk|network|processes|events}
/alerts
/events
/agents
/settings
```

---

## 3. Core product surfaces (summary)

| Surface | Primary question / job |
|---|---|
| **Overview** | Is my infrastructure healthy? KPIs, health mix, active alerts, top consumers (summary data — not every raw series) |
| **Servers** | Fleet list: card/table, search, status/OS/tag filters, sort by CPU/mem/disk/last seen |
| **Server detail** | One host: header meta, KPI strip, LIVE\|5m…30d range, tabbed CPU/mem/disk/net/processes/events |
| **CPU / Memory / Disk / Network** | Rich metrics (load avg, user/sys/idle; used/cached/available/swap; mounts + IOPS; per-iface Mbps + errors) |
| **Processes** | Top N by CPU and memory (not full process dump every tick); detail on demand |
| **Agents** | Monitor the monitor: version, last seen, sample health, connection vs host health |
| **Alerts** | Rules with duration (e.g. CPU > 90% for 5m); states OK→PENDING→FIRING→ACK→RESOLVED |
| **Events** | Timeline of things that happened (distinct from alert instances) |

---

## 4. Contract evolution

Evolve toward a structured envelope (names indicative):

```protobuf
message MetricsEnvelope {
  string server_id = 1;
  int64 collected_at_unix_ms = 2;
  uint64 sequence = 3;
  HostInfo host = 4;
  CpuMetrics cpu = 5;
  MemoryMetrics memory = 6;
  repeated DiskMetrics disks = 7;
  repeated NetworkMetrics networks = 8;
  repeated ProcessMetrics top_processes = 9;
  AgentInfo agent = 10;
}
```

**Required additions vs v1:** `collected_at`, `sequence`, host/agent metadata, multi-disk, **agent-side network and disk I/O rates**, top processes payload.

Rates are derived **in the agent** (owns the sample interval).

Backward-compatible migration: prefer additive fields / new message with dual-publish or versioned service during transition; exact strategy is a v2.1 plan decision.

---

## 5. Live WebSocket (v2)

v1 global `/ws/metrics` broadcast is acceptable for small fleets only.

v2: subscription protocol on `/ws/metrics` (or successor):

```json
{ "type": "subscribe", "servers": ["web-01", "db-01"] }
```

Support fleet-summary subscriptions for Overview so browsers do not ingest every host’s raw stream.

---

## 6. Historical storage

| Store | Role |
|---|---|
| **PostgreSQL + TimescaleDB** | Metrics history, registry, alerts, events |

**Default retention (configurable):**

| Resolution | Retention |
|---|---|
| Raw ~2s | 24 hours |
| 1-minute rollup | 30 days |
| 5-minute rollup | 1 year |

Dedicated engines (e.g. VictoriaMetrics) are deferred until fleet scale requires them.

---

## 7. Registry & health model

Replace env-only `AGENTS=...` with a DB-backed registry (Add Server UI). Keep env bootstrap optional for Compose smoke tests.

### Connection vs health (separate)

| Dimension | Values |
|---|---|
| **Agent connection** | CONNECTED / DISCONNECTED |
| **Server health** | HEALTHY / WARNING / CRITICAL / OFFLINE / UNKNOWN |

A host can be CONNECTED + CRITICAL (agent healthy, machine not).

Tags (e.g. `production`, `database`, `cambodia-office`) are first-class for filtering.

---

## 8. Frontend stack (v2)

Keep: Next.js 16, React 19, Tailwind 4, shadcn/ui, ECharts, lucide-react, Maven Pro.

**Add:** TanStack Query for REST (servers, history, alerts, events, settings).

| Concern | Mechanism |
|---|---|
| REST / history / registry | TanStack Query |
| Live telemetry | WebSocket |
| Local UI only | React state (filters, range, dialogs) |

Explicit UI states on every page: Loading, Connected, Disconnected, No data, Stale data, Error, Empty. Never present frozen charts as live.

---

## 9. Phased delivery

| Phase | Focus |
|---|---|
| **v2.1 — Monitoring foundation** | Proto envelope (timestamp, sequence, meta); agent rates + last-seen; health model; scoped WS subscriptions; DB registry; Timescale persistence; Compose verification |
| **v2.2 — New UI** | Nav + Overview, Servers, Detail (+ CPU/mem/disk/net), Agents, history ranges, filters/tags, responsive |
| **v2.3 — Alerts & events** | Rules with duration, evaluator, firing/ack/resolved, events timeline |
| **v2.4 — Hardening** | Auth, RBAC, TLS, WS auth, audit, maintenance windows, notifications, self-metrics, HA |

### Highest-priority implementation order

1. Improve `monitoring.proto`  
2. Agent-side rate calculations  
3. Server/agent state model  
4. Historical persistence  
5. Scoped WS subscriptions  
6. Overview  
7. Servers  
8. Server Detail  
9. Alerts  
10. Events  

---

## 10. Explicit non-goals (now)

Remote terminal, process kill, reboot, package install, auto-remediation, Kubernetes management, log platform, full APM/tracing.

---

## 11. Decomposition note

This spec is a **product roadmap**, not a single implementation plan. Execution proceeds phase-by-phase starting with **v2.1**, each with its own `docs/superpowers/plans/` plan after this design is approved.

## 12. Relation to v1

| v1 artifact | v2 disposition |
|---|---|
| Go agent + gopsutil + gRPC stream | Extend (rates, meta, processes) |
| Spring Boot WS fan-out + `/healthz` | Extend (subscriptions, ingestion, alerts, REST) |
| Next.js live dashboard | Restructure into multi-route product shell |
| `AGENTS` env registry | Bootstrap only; DB becomes source of truth |
| Cumulative network counters | Supplanted by agent-computed rates (counters may remain for debug) |

---

## Design decisions locked from authoring session

- Keep v1 pipeline; build around it  
- LIVE vs HISTORICAL paths split  
- PostgreSQL + TimescaleDB for history  
- Alert duration conditions (not instantaneous spikes)  
- Observe → Detect → Investigate product boundary  
- Frontend: TanStack Query + WS + local UI state  

# Pulsegrid — Process Monitoring Subsystem

**Date:** 2026-09-13  
**Status:** Approved direction — implement in phases  
**Source:** Product design for process-focused observability

## Principle

Processes are a **subsystem**, not a shallow PID/CPU/MEM table.

## Phases

| Phase | Scope |
|---|---|
| **P0 (this slice)** | Richer `ProcessMetrics` + `ProcessSummary` on stream; Process Health; Top CPU/MEM; denser table (search/sort/state); table/tree toggle stub; detail drawer (basic fields) |
| **P1** | Per-process sparklines (ring buffer top N); Top Disk I/O widget; full tree; column picker |
| **P2** | `GetProcessDetails(pid)` RPC; services/containers; process network |
| **P3** | Dedicated `/servers/[id]/processes` routes; TanStack Table + Virtual |

## Stream vs on-demand

```text
StreamMetrics → summary counts + top processes (basic enriched fields)
GetProcessDetails(pid) → command, files, sockets, cgroup (later)
```

## Contract (P0)

See `proto/monitoring.proto`: expanded `ProcessMetrics` + `ProcessSummary` on `MetricsEnvelope`.

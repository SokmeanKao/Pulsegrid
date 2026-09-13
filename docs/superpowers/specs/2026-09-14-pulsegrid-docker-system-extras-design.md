# Pulsegrid — Docker + System Extras Widgets

**Status:** Approved for implementation  
**Date:** 2026-09-14  
**Version target:** v2.1.0 (additive; no hard cut)

## Summary

Add three dashboard widgets backed by new optional fields on the existing ~2s `MetricsEnvelope`:

| Widget | Purpose |
|---|---|
| **Docker** | Engine availability, container counts, top containers by CPU/mem |
| **Host** | Uptime + load averages |
| **Sensors** | GPU util/mem (NVIDIA if present) + temperatures when readable |

**Approach:** Extend the agent-initiated metrics stream (Approach 1). No new gRPC service. Graceful degrade when Docker/GPU/sensors are absent.

## Goals

- Proto + Go collection + Java DTO/mapper + terminal widgets
- Add Widget catalog entries with layout size profiles
- Never fail the whole sample if Docker or sensors are unavailable

## Non-goals

- Compose project UI, container logs/exec, Docker event stream
- Non-NVIDIA GPU vendors (may show nothing)
- Separate scrape channel or different interval for Docker
- Requiring Docker on every agent host

## Architecture

```text
Agent collector
  ├── host extras (uptime, load)
  ├── docker (Engine API via socket/npipe)
  └── sensors (NVIDIA / platform temps)     [best-effort]
        │
        ▼
  MetricsEnvelope (+ optional fields)
        │
  AgentGateway.Connect (unchanged)
        │
  Backend EnvelopeMapper → DTO → WS
        │
  Dashboard widgets: docker | host | sensors
```

## Proto

Add to `MetricsEnvelope` (field numbers after existing ones):

```protobuf
message HostExtras {
  uint64 uptime_seconds = 1;
  double load1 = 2;
  double load5 = 3;
  double load15 = 4;
  bool load_available = 5; // false on platforms without loadavg
}

message DockerContainer {
  string id = 1;          // short id
  string name = 2;
  string image = 3;
  string state = 4;       // running | exited | paused | ...
  double cpu_percent = 5;
  double memory_mb = 6;
}

message DockerSummary {
  bool available = 1;
  string server_version = 2;
  uint32 containers_running = 3;
  uint32 containers_paused = 4;
  uint32 containers_stopped = 5;
  uint32 images = 6;
  repeated DockerContainer top_containers = 7; // up to ~8
  string error_message = 8; // optional soft reason when !available
}

message GpuSensor {
  string name = 1;
  double utilization_percent = 2;
  double memory_used_mb = 3;
  double memory_total_mb = 4;
  double temperature_c = 5;
}

message TempSensor {
  string name = 1;
  double celsius = 2;
}

message SensorSummary {
  repeated GpuSensor gpus = 1;
  repeated TempSensor temperatures = 2;
}

// on MetricsEnvelope:
// HostExtras host_extras = 12;
// DockerSummary docker = 13;
// SensorSummary sensors = 14;
```

## Agent collection

### Host extras
- Uptime via gopsutil `host.Uptime`
- Load via gopsutil `load.Avg` when supported; set `load_available=false` on Windows if unavailable

### Docker
- Client to default endpoint:
  - Windows: `npipe:////./pipe/docker_engine`
  - Linux/macOS: `unix:///var/run/docker.sock`
- On failure: `available=false`, optional short `error_message`, leave counts at 0
- On success: Engine version, container counts from list API, top containers with stats (cap list length; skip heavy per-container stats if too slow — prefer list + lightweight stats)

### Sensors
- NVIDIA: try `nvidia-smi` query (CSV) or NVML; ignore if missing
- Temps: platform sensors when gopsutil/OS APIs expose them; otherwise empty list
- Errors must be swallowed at collector boundary

## Backend

- Extend `MetricsEnvelopeDto` + `EnvelopeMapper` with new nested objects
- No registry/gateway changes
- WS JSON remains camelCase via existing mapping

## Dashboard

### Widget types
Add to `WidgetType`: `"docker" | "host" | "sensors"`

### Registry
- Category: Docker → `SYSTEM` or new `RUNTIME`; Host/Sensors → `SYSTEM`
- Heights (GridStack): e.g. docker 6/8/12, host 4/5/6, sensors 5/6/8
- Icons: Lucide `Container` / `Server` / `Thermometer` (or equivalent)

### Panels
- `DockerPanel` — counts row + container table/bars; empty/unavailable copy
- `HostPanel` — uptime formatted + load lines
- `SensorsPanel` — GPU rows + temp rows; “No sensors detected” if both empty

Wire into `DashboardWidgetView`, presets optional (not required in default general preset), Add Widget modal via catalog.

### Runtime / skeletons
- Derive ready when sample present; docker `available=false` is still **ready** with unavailable UI (not error)
- Type-specific skeletons for loading

## Permissions / ops notes

- Linux agents reading Docker usually need membership in `docker` group or root
- Document in agent README: Docker socket access optional
- Windows: Docker Desktop must be running for `available=true`

## Testing

1. Host without Docker → Docker widget shows unavailable; CPU/etc still update  
2. Host with Docker → counts and container names appear within a few samples  
3. Windows host → Host widget shows uptime; load may show “—”  
4. Machine with NVIDIA → Sensors shows GPU; without → empty message  
5. Add Widget can place all three; layout profiles resize heights  

## Out of scope follow-ups

- Compose grouping, logs, exec  
- AMD/Intel GPU  
- Cached slower Docker poll independent of 2s ticker  

## Implementation order

1. Proto + regenerate stubs  
2. Agent collectors + envelope fill  
3. DTO / mapper  
4. Dashboard widgets + registry  
5. Docs (agent README note)  
6. Commit / push (tag v2.1.0 optional)

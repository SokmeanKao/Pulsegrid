# Pulsegrid — Implementation Status & Stack

**Last updated:** 2026-09-14 (v2.0.0)

**Install:** [INSTALL.md](./INSTALL.md) · **Monitor:** [MONITOR.md](./MONITOR.md)

## Architecture

```text
Go agent (per host)  --TLS gRPC AgentGateway.Connect-->  Spring Boot Agent Gateway :50051
                                                              |
                                                      Timescale + /ws/metrics
                                                              |
                                                     Next.js dashboard
```

**Product rule:** agents always initiate the connection.

Single contract: `proto/monitoring.proto` → Go stubs + Java stubs (Gradle protobuf plugin).

---

## Stack

| Layer | Tech |
|---|---|
| **Agent** | Go 1.22, gRPC **client**, protobuf, gopsutil/v3 |
| **Backend** | Java 21, Spring Boot, WebSocket, Reactor `Sinks.Many`, gRPC **server** (TLS Netty), Flyway |
| **Dashboard** | Next.js (App Router), React, Tailwind, Lucide, ECharts, GridStack |
| **Ops** | Docker Compose, install scripts, OpenSSL LAN CA |
| **Contract** | `AgentGateway.Connect` bidi stream (HELLO / METRICS / HEARTBEAT) |

### Env / config

| Var | Where | Purpose |
|---|---|---|
| `SERVER_ID` | Agent | Host id |
| `MONITOR_ADDRESS` | Agent | `host:port` of Agent Gateway |
| `MONITOR_CA_FILE` | Agent | Path to Monitor `ca.crt` |
| `JOIN_TOKEN` | Agent | First-enroll token (`pg_join_…`) |
| `GATEWAY_*` | Backend | TLS cert paths, advertise host, port |
| `NEXT_PUBLIC_WS_URL` | Dashboard | Browser WebSocket URL |
| `NEXT_PUBLIC_API_URL` | Dashboard | Browser API base (enroll) |

---

## Implementation status

### Done (v2.0)

| Area | Notes |
|---|---|
| Agent-initiated gateway | TLS `:50051`, bidi `Connect` |
| Enrollment tokens | `POST /api/agents/enroll`, Add Agent UI |
| Hard cut | No `AGENTS`, no agent listen port, no Monitor dial-out |
| Terminal dashboard | Layout profiles, fullscreen, prefs |
| Process metrics | Health / top / list with internal scroll |
| Installers + docs | Monitor/agent one-liners rewritten |

### Follow-up

| Area | Notes |
|---|---|
| mTLS after registration | Specced for v2.1+ |
| Monitor→agent commands | Reserved in proto (`ConfigUpdate` / `AgentCommand`) |
| Let’s Encrypt / public ACME | Optional later; LAN CA is default |

---

## Releases

| Tag | Highlights |
|---|---|
| **v2.0.0** | Agent-initiated TLS gateway, join tokens, hard cut |
| v1.3.0 | Terminal dashboard, layout profiles, process UI |
| v1.2.0 | Agent release pipeline / one-line Linux install |

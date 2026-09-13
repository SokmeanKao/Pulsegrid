# Pulsegrid v2.0 — Agent-Initiated Gateway Design

**Status:** Approved for implementation planning  
**Date:** 2026-09-14  
**Version target:** v2.0 (hard cut)

## Summary

Pulsegrid flips from **Monitor dials agents** to **agents dial Monitor**.

```text
OLD:  Monitor ─────► Agent:50051
NEW:  Agent   ─────► Monitor Agent Gateway:50051 (TLS)
```

**Product rule:** Pulsegrid Agent always initiates the connection to Pulsegrid Monitor.

Agents no longer expose port 50051. The Monitor no longer uses `AGENTS` or outbound gRPC. New hosts appear after install + successful HELLO — no `.env` edit, no backend restart.

## Goals

- Agent-initiated persistent gRPC connection to Monitor
- Remove `AGENTS`, agent listen ports, and Monitor→agent dial-out
- Enrollment tokens from UI “Add Agent”
- TLS now via installer-generated LAN CA + server cert
- Runtime connected-agent registry (ONLINE / OFFLINE)
- Documented follow-up path for mTLS after registration (v2.1+)

## Non-goals (v2.0)

- mTLS client certificates (follow-up)
- Let’s Encrypt / public ACME (follow-up; operator-provided certs can come later)
- Full Monitor→agent command framework beyond Welcome intervals
- Dual-mode / soft migration with old pull path

## Architecture

```text
                       Browser
                          │
                  http(s)://monitor:3000
                  ws://monitor:8080/ws/metrics
                          │
                    ┌─────┴─────┐
                    │  Monitor  │
                    │ Next.js   │
                    │ Spring    │
                    │ Timescale │
                    │           │
                    │ Agent     │
                    │ Gateway   │◄── TLS :50051
                    └─────▲─────┘
                          │
                 persistent bidi streams
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                  │
     Agent A           Agent B            Agent C
     (outbound only)   (outbound only)    (outbound only)
```

### Components

| Component | Role in v2.0 |
|---|---|
| **Agent Gateway** (Spring gRPC server) | Accepts TLS connections; authenticates HELLO; owns live sessions |
| **Session registry** | In-memory map `serverId → session` + DB `servers` / `last_seen` |
| **Enrollment service** | Create/validate/consume join tokens |
| **Cert bootstrap** | Monitor install generates CA + gateway server cert |
| **Go agent** | gRPC **client**; collect metrics; Connect stream; reconnect |
| **Dashboard** | Add Agent wizard; connected servers list; existing WS metrics path |

### Removed

- `AGENTS` env and install-monitor `--agents` / `-Agents`
- Backend `AgentClient` outbound dial loop
- Agent `PORT` listen / `grpc.NewServer` as the live path
- Proto live path RPCs: `GetMetrics`, `StreamMetrics`, `HealthCheck` (hard cut)

## Protocol

Monitor is the gRPC **server**. Agent is the gRPC **client**.

```protobuf
service AgentGateway {
  rpc Connect(stream AgentMessage) returns (stream MonitorMessage);
}
```

### AgentMessage

```text
oneof payload:
  AgentHello hello
  MetricsEnvelope metrics   // reuse existing envelope shape
  Heartbeat heartbeat
  CommandResult command_result  // reserved; unused in v2.0 UI
```

**AgentHello** includes at least:

- `server_id`
- `hostname`, `os`, `architecture`
- `agent_version`
- `join_token` (required on first enrollment; may be omitted on reconnect once bound — see Enrollment)

### MonitorMessage

```text
oneof payload:
  Welcome welcome
  Reject reject
  ConfigUpdate config_update   // reserved
  AgentCommand command         // reserved
```

**Welcome** includes:

- `accepted = true`
- `heartbeat_interval_seconds` (default 10)
- `metrics_interval_seconds` (default 2)

**Reject** includes reason code/message (invalid token, TLS/auth failure path already closed before HELLO, duplicate policy, etc.).

### Session flow

```text
Agent                          Monitor Gateway
  │                                  │
  │──── TLS connect ────────────────►│
  │──── HELLO (+ token) ────────────►│
  │                                  │ validate token / binding
  │◄─── WELCOME or REJECT ───────────│
  │                                  │ register/replace session
  │──── METRICS (~2s) ──────────────►│ → Timescale → WS hub
  │──── HEARTBEAT ──────────────────►│
  │◄─── (optional CONFIG later) ─────│
```

### Reconnect

On disconnect, agent retries with exponential backoff capped at 30s:

```text
1s → 2s → 4s → 8s → 15s → 30s → 30s …
```

Same `server_id` on successful HELLO **replaces** any existing live session (reinstall/reconnect wins). systemd/Windows service keeps running.

### Stale / OFFLINE

Monitor marks a host OFFLINE when the bidi stream ends and no replacement connects. UI uses live session presence; `last_seen` supports refresh and history. Suggested stale display threshold: **10–15s** without metrics/heartbeat while expecting ONLINE.

## Enrollment & TLS

### Enrollment tokens

1. Operator opens UI → **Add Agent**
2. Enters agent name / `server_id` (e.g. `kali-01`)
3. Monitor creates an enrollment token `pg_join_…` (store **hash only**)
4. UI shows copy-paste install command including:
   - `--server-id`
   - `--monitor <public-host>:50051`
   - `--token`
   - CA trust material (file path, inline PEM, or fingerprint pin per installer UX)

**Token rules (v2.0):**

- Bound to intended `server_id`
- Short TTL (e.g. 24h) and/or single-use on first successful HELLO
- After successful enrollment, agent may reconnect with the same `server_id` without presenting a fresh token **if** Monitor recognizes the registered host (token already consumed). Optional hardening: require token until mTLS lands — **decision for v2.0: allow reconnect without token for already-registered hosts** to avoid re-enrollment after every Monitor restart; rely on TLS + known `server_id`. Unregistered HELLO without valid token → REJECT.

### TLS (v2.0)

- Monitor installer generates:
  - Local CA key/cert
  - Gateway server cert signed by that CA (SAN includes `--public-host` IP/DNS)
- Gateway listens with TLS only (no plaintext gRPC in v2.0)
- Agent trusts the Monitor CA (or pins CA fingerprint)
- Certs live under Monitor data dir (e.g. `certs/`)

### Follow-up: mTLS (v2.1+)

```text
FIRST CONNECTION:  TLS + join token
AFTER REGISTRATION: issue agent client cert → mTLS
```

Tokens become bootstrap-only. Spec only; not implemented in v2.0.

## Data model

### `servers` (migrate)

Today requires `grpc_host` / `grpc_port` for Monitor dial-out. v2.0:

- Drop **required** outbound address fields (nullable or remove)
- Keep / populate from HELLO: `hostname`, `os`, `architecture`, `agent_version`, `first_seen`, `last_seen`
- Optional: `last_remote_addr` from gateway peer
- Status ONLINE/OFFLINE is primarily **session-derived**; persist `last_seen` for UI after restart

### `enrollment_tokens` (new)

| Column | Notes |
|---|---|
| `id` | UUID |
| `server_id` | Intended host id |
| `token_hash` | SHA-256 of secret |
| `expires_at` | Required |
| `used_at` | Null until consumed |
| `created_at` | |
| `created_by` | Optional string / “ui” |

### Metrics path

Unchanged conceptually: gateway receives `MetricsEnvelope` → persist `metric_samples` → broadcast WebSocket. Dashboard consumers keep working.

## Installation

### Monitor

```bash
curl -fsSL …/install-monitor.sh | sudo bash -s -- --public-host 192.168.150.10
```

Resulting surface:

| Port | Service |
|---|---|
| 3000 | Dashboard |
| 8080 | API / WebSocket |
| 50051 | Agent Gateway (TLS) |
| internal | TimescaleDB |

No `AGENTS`. Installer generates CA + server cert and documents trust bundle location / fingerprint.

### Agent

```bash
curl -fsSL …/install-agent.sh | sudo bash -s -- \
  --server-id kali-01 \
  --monitor 192.168.150.10:50051 \
  --token pg_join_xxxxx \
  --ca …   # or fingerprint flag
```

Agent config (conceptual):

```yaml
serverId: kali-01
monitor:
  address: 192.168.150.10:50051
  caFile: /etc/pulsegrid/ca.crt
collection:
  interval: 2s
```

### Windows

Mirror flags on PowerShell install/run scripts: `--monitor` / `-Monitor`, `-Token`, `-CaFile`; no agent listen port.

## UI

- Servers empty state: “No agents connected yet” + **Add Agent**
- Add Agent dialog: name → generate token → show install command + Copy
- Servers table: `serverId`, status, remote address, last seen
- Remove any UX that asks operators to edit `AGENTS` or agent host:port

## Firewall

| Host | Rule |
|---|---|
| Monitor | ALLOW TCP 50051 (and 3000/8080 for operators) |
| Agent hosts | No inbound Pulsegrid port; outbound to Monitor:50051 |

## Error handling

| Case | Behavior |
|---|---|
| Invalid/expired token | REJECT; no registry promotion |
| Unregistered HELLO without token | REJECT |
| Unknown/untrusted CA | TLS handshake fails; agent retries |
| Duplicate online `server_id` | Kick old session; accept new |
| Monitor restart | Agents reconnect via backoff; re-HELLO |
| Stream idle failure | Agent reconnects; Monitor marks OFFLINE until back |

## Testing (acceptance)

1. Fresh Monitor install with `--public-host` only — gateway :50051 up, no `AGENTS`
2. Add Agent in UI → copy install → agent comes ONLINE without Monitor `.env` change
3. Metrics appear in `/terminal` within a few seconds
4. Stop agent → OFFLINE; start agent → ONLINE with same id
5. Kill Monitor briefly → agent reconnects automatically
6. Bad token → REJECT / not listed as ONLINE
7. Agent host has no listening :50051
8. Docs/install scripts no longer mention `AGENTS` or Monitor dialing agents

## Migration (hard cut)

Existing v1.x deployments must:

1. Upgrade Monitor to v2.0
2. Reinstall agents with `--monitor`, `--token`, and CA trust
3. Remove old agent firewall allows for :50051
4. Delete obsolete `AGENTS` from any leftover `.env`

No dual-stack compatibility window.

## Implementation sketch (for planning)

Order of work (high level):

1. Proto: `AgentGateway` + messages; regenerate Go/Java stubs
2. Backend: TLS gRPC server, session registry, enrollment API, remove `AgentClient` / `AGENTS` bootstrap
3. DB migration for `servers` + `enrollment_tokens`
4. Agent: client Connect loop, TLS, config flags, remove listen server
5. Cert generation in monitor installer
6. Update install-agent / install-monitor / README / INSTALL.md
7. Dashboard Add Agent + servers status from registry API
8. Compose: publish 50051; remove demo pull-agent assumptions or rework demo agents as clients

## Open decisions resolved

| Topic | Decision |
|---|---|
| Scope | Full production path: tokens + TLS now; mTLS follow-up |
| Certs | Auto self-signed LAN CA on Monitor install |
| Migration | Hard cut in v2.0 |
| Transport | Bidirectional `AgentGateway.Connect` |
| Duplicate session | New connection replaces old |
| Reconnect auth | Registered hosts may reconnect without new token (TLS + server_id) |

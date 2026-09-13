# Agent-Initiated Gateway (v2.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hard-cut Pulsegrid so agents dial a TLS Agent Gateway on the Monitor (`Connect` bidi stream), enroll with join tokens, and appear in the UI without `AGENTS` or inbound agent ports.

**Architecture:** Monitor runs a gRPC **server** on `:50051` (TLS, LAN CA). Agents are gRPC **clients** that send HELLO → metrics/heartbeats on `AgentGateway.Connect`. Enrollment tokens gate first registration; registered hosts may reconnect with TLS + `serverId` only. Metrics still flow Timescale → WebSocket unchanged.

**Tech Stack:** protobuf3, Go agent (`google.golang.org/grpc`), Spring Boot + grpc-netty-shaded, Flyway, Next.js dashboard, Docker Compose, bash/PowerShell installers, OpenSSL for CA bootstrap.

**Spec:** `docs/superpowers/specs/2026-09-14-pulsegrid-agent-initiated-gateway-design.md`

## Global Constraints

- Hard cut: remove `AGENTS`, Monitor→agent dial, agent listen port — no dual-mode
- Product rule: Agent always initiates connection to Monitor
- TLS required on gateway in v2.0 (no plaintext gRPC)
- Enrollment token on first HELLO for unregistered hosts; reconnect without new token if already registered
- Duplicate online `serverId`: kick old session, accept new
- Reconnect backoff: 1s → 2s → 4s → 8s → 15s → 30s cap
- Default intervals: metrics 2s, heartbeat 10s
- mTLS after registration is **out of scope** (document only)
- Version target label: **v2.0**

---

## File structure (target)

| Path | Responsibility |
|---|---|
| `proto/monitoring.proto` | `AgentGateway` + messages; drop old pull RPCs |
| `backend/src/main/proto/monitoring.proto` | Mirror of canonical proto |
| `backend/.../db/migration/V2__agent_gateway.sql` | servers reshape + `enrollment_tokens` |
| `backend/.../enrollment/EnrollmentService.java` | create/validate/consume tokens |
| `backend/.../enrollment/EnrollmentController.java` | REST for Add Agent |
| `backend/.../gateway/AgentSessionRegistry.java` | live bidi sessions by serverId |
| `backend/.../gateway/AgentGatewayService.java` | gRPC `Connect` handler |
| `backend/.../gateway/GrpcGatewayServer.java` | TLS Netty gRPC server lifecycle |
| `backend/.../registry/ServerRegistry.java` | DB upsert from HELLO (no AGENTS) |
| `agent/internal/gateway/client.go` | dial Monitor, Connect loop, backoff |
| `agent/cmd/pulsegrid-agent/main.go` | client entry (no listen) |
| `scripts/generate-monitor-certs.sh` | CA + server cert |
| `scripts/install-monitor.sh` / `.ps1` | no `--agents`; publish 50051; gen certs |
| `scripts/install-agent.sh` | `--monitor` `--token` `--ca` |
| `dashboard/...` | Add Agent UI + servers list |
| `docs/INSTALL.md`, `README.md`, `.env.example` | install model rewrite |

**Delete / stop using:** `backend/.../grpc/AgentClient.java`, `agent/internal/server/grpc_server.go` (or gut to unused), `PORT` listen path.

---

### Task 1: Proto — `AgentGateway` hard cut

**Files:**
- Modify: `proto/monitoring.proto`
- Modify: `backend/src/main/proto/monitoring.proto` (keep in sync)
- Regenerate: `agent/internal/pb/*.go`, Java stubs via Gradle

**Interfaces:**
- Produces: `service AgentGateway { rpc Connect(stream AgentMessage) returns (stream MonitorMessage); }`
- Produces messages: `AgentMessage`, `MonitorMessage`, `AgentHello`, `Heartbeat`, `Welcome`, `Reject` (+ reserved stubs ok)
- Keeps: existing `MetricsEnvelope` and metric message types

- [ ] **Step 1: Replace the service block in both proto files**

Remove `PulsegridService` / `GetMetrics` / `StreamMetrics` / `HealthCheck` / empty request messages used only by them.

Add (keep all existing metric messages below unchanged):

```protobuf
service AgentGateway {
  rpc Connect(stream AgentMessage) returns (stream MonitorMessage);
}

message AgentHello {
  string server_id = 1;
  string hostname = 2;
  string os = 3;
  string arch = 4;
  string agent_version = 5;
  string join_token = 6; // required for unregistered hosts
}

message Heartbeat {
  int64 unix_ms = 1;
}

message CommandResult {
  string command_id = 1;
  bool ok = 2;
  string message = 3;
}

message AgentMessage {
  oneof payload {
    AgentHello hello = 1;
    MetricsEnvelope metrics = 2;
    Heartbeat heartbeat = 3;
    CommandResult command_result = 4;
  }
}

message Welcome {
  bool accepted = 1;
  uint32 heartbeat_interval_seconds = 2;
  uint32 metrics_interval_seconds = 3;
}

message Reject {
  string code = 1;
  string message = 2;
}

message ConfigUpdate {
  uint32 metrics_interval_seconds = 1;
  uint32 heartbeat_interval_seconds = 2;
}

message AgentCommand {
  string command_id = 1;
  string type = 2;
  string payload_json = 3;
}

message MonitorMessage {
  oneof payload {
    Welcome welcome = 1;
    Reject reject = 2;
    ConfigUpdate config_update = 3;
    AgentCommand command = 4;
  }
}
```

- [ ] **Step 2: Regenerate stubs**

```powershell
# Go
protoc --proto_path=proto `
  --go_out=agent/internal/pb --go_opt=paths=source_relative `
  --go-grpc_out=agent/internal/pb --go-grpc_opt=paths=source_relative `
  proto/monitoring.proto

# Java
cd backend; .\gradlew.bat generateProto
```

Expected: `AgentGatewayGrpc` appears; `PulsegridServiceGrpc` gone. Fix compile breaks in later tasks (expected temporarily).

- [ ] **Step 3: Commit**

```bash
git add proto/monitoring.proto backend/src/main/proto/monitoring.proto agent/internal/pb backend/build
git commit -m "proto: replace pull RPCs with AgentGateway.Connect bidi stream"
```

---

### Task 2: DB migration — servers + enrollment_tokens

**Files:**
- Create: `backend/src/main/resources/db/migration/V2__agent_gateway.sql`
- Modify: `backend/.../registry/ServerRegistry.java` (in Task 4; migration only here)

**Interfaces:**
- Produces tables/columns matching enrollment + HELLO upsert

- [ ] **Step 1: Add Flyway migration**

```sql
-- V2__agent_gateway.sql
ALTER TABLE servers
  ALTER COLUMN grpc_host DROP NOT NULL,
  ALTER COLUMN grpc_port DROP NOT NULL;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS last_remote_addr TEXT;

CREATE TABLE IF NOT EXISTS enrollment_tokens (
  id          UUID PRIMARY KEY,
  server_id   TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  TEXT NOT NULL DEFAULT 'ui'
);

CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_server
  ON enrollment_tokens (server_id);
```

- [ ] **Step 2: Verify migration on empty DB**

```powershell
cd c:\Dev\Pulsegrid
docker compose up -d db
# point local bootRun or compose backend at db; confirm flyway applies V2
```

Expected: `enrollment_tokens` exists; `grpc_host`/`grpc_port` nullable.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V2__agent_gateway.sql
git commit -m "db: allow agent-initiated servers and enrollment tokens"
```

---

### Task 3: Enrollment service + REST API

**Files:**
- Create: `backend/src/main/java/com/monitoring/backend/enrollment/EnrollmentService.java`
- Create: `backend/src/main/java/com/monitoring/backend/enrollment/EnrollmentController.java`
- Create: `backend/src/test/java/com/monitoring/backend/enrollment/EnrollmentServiceTest.java`

**Interfaces:**
- Produces: `EnrollmentService.create(serverId, ttl) → CreateResult(serverId, tokenPlain, expiresAt, installHint fields)`
- Produces: `EnrollmentService.validateAndConsume(serverId, tokenPlain) → boolean` (or result enum)
- Produces: `EnrollmentService.isRegistered(serverId) → boolean`
- REST: `POST /api/agents/enroll` body `{ "serverId": "kali-01" }` → token + install command pieces
- REST: `GET /api/agents` → list from live cache / registry (wire fully in Task 5)

- [ ] **Step 1: Write failing unit test**

```java
@Test
void createAndConsumeTokenOnce() {
  // use JdbcTemplate against Testcontainers OR in-memory H2 if project lacks TC —
  // prefer Mockito + fake jdbc only if no DB test infra; otherwise @SpringBootTest.
  var created = enrollmentService.create("kali-01", Duration.ofHours(24));
  assertTrue(created.token().startsWith("pg_join_"));
  assertTrue(enrollmentService.validateAndConsume("kali-01", created.token()));
  assertFalse(enrollmentService.validateAndConsume("kali-01", created.token()));
}
```

If the repo has no existing test DB pattern, use a focused pure unit for hashing + a thin integration test later; still add `EnrollmentServiceTest` that covers hash/consume logic with `JdbcTemplate` mocked.

- [ ] **Step 2: Implement EnrollmentService**

Rules:
- Generate `pg_join_` + 32 url-safe random bytes
- Store `SHA-256` hex of token only
- `validateAndConsume`: match `server_id`, `used_at IS NULL`, `expires_at > now`, then set `used_at`
- `isRegistered`: row exists in `servers` for id

- [ ] **Step 3: Implement EnrollmentController**

```http
POST /api/agents/enroll
{ "serverId": "kali-01" }

→ 200 {
  "serverId": "kali-01",
  "token": "pg_join_...",
  "expiresAt": "...",
  "monitorAddress": "${GATEWAY_ADVERTISE_HOST}:50051",
  "installCommand": "curl ... | sudo bash -s -- --server-id kali-01 --monitor ... --token ..."
}
```

Inject advertise host from env `GATEWAY_ADVERTISE_HOST` (set by installer / compose from `--public-host`).

- [ ] **Step 4: Run tests**

```powershell
cd backend; .\gradlew.bat test --tests EnrollmentServiceTest
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/monitoring/backend/enrollment backend/src/test/java/com/monitoring/backend/enrollment
git commit -m "feat: enrollment tokens API for Add Agent"
```

---

### Task 4: Rewrite ServerRegistry (no AGENTS)

**Files:**
- Modify: `backend/src/main/java/com/monitoring/backend/registry/ServerRegistry.java`
- Modify: `backend/src/main/java/com/monitoring/backend/api/ServersController.java`
- Modify: `backend/src/main/java/com/monitoring/backend/health/HealthController.java` (stop depending on AgentClient)

**Interfaces:**
- Produces: `upsertFromHello(serverId, hostname, os, arch, agentVersion, remoteAddr)`
- Produces: `isRegistered(serverId)`, `touchLastSeen(serverId)`
- Removes: `AGENTS` bootstrap, `AgentEndpoint` host:port dial targets, `POST /api/servers` host/port body

- [ ] **Step 1: Replace ServerRegistry**

Remove `@Value("${AGENTS:}")` and `bootstrapFromEnvIfEmpty`.

```java
public void upsertFromHello(
    String serverId,
    String hostname,
    String os,
    String arch,
    String agentVersion,
    String remoteAddr) {
  jdbc.update("""
    INSERT INTO servers (id, name, hostname, os, architecture, agent_version,
                         last_remote_addr, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      hostname = EXCLUDED.hostname,
      os = EXCLUDED.os,
      architecture = EXCLUDED.architecture,
      agent_version = EXCLUDED.agent_version,
      last_remote_addr = EXCLUDED.last_remote_addr,
      last_seen = NOW()
    """,
    serverId, serverId, hostname, os, arch, agentVersion, remoteAddr);
}

public boolean isRegistered(String serverId) {
  Integer n = jdbc.queryForObject(
      "SELECT COUNT(*) FROM servers WHERE id = ?", Integer.class, serverId);
  return n != null && n > 0;
}
```

- [ ] **Step 2: Change ServersController `POST /api/servers`**

Either delete it or make it delegate to enroll (`302`/`deprecated`). Prefer: remove host/port add; list remains `GET /api/servers` from LiveStateCache.

- [ ] **Step 3: Compile**

```powershell
cd backend; .\gradlew.bat compileJava
```

Expected: fails until AgentClient removed / gateway added — fix in Task 5–6.

- [ ] **Step 4: Commit registry-focused changes that compile** (or commit with Task 6 if entangled)

```bash
git commit -m "refactor: ServerRegistry upserts from agent HELLO, drop AGENTS"
```

---

### Task 5: AgentSessionRegistry + Gateway gRPC service

**Files:**
- Create: `backend/.../gateway/AgentSessionRegistry.java`
- Create: `backend/.../gateway/AgentGatewayService.java`
- Modify: wire `MetricsHub`, `LiveStateCache`, `HistoryWriter`, `EnrollmentService`, `ServerRegistry`

**Interfaces:**
- `AgentSessionRegistry.register(serverId, outboundObserver) / remove / get`
- On HELLO success: upsert DB, register session, send Welcome
- On METRICS: map envelope → hub + live + history (same as old AgentClient path)
- On stream end/error: `liveStateCache.markDisconnected(serverId)`, remove session

- [ ] **Step 1: Implement session registry**

```java
public final class AgentSessionRegistry {
  private final ConcurrentHashMap<String, Session> sessions = new ConcurrentHashMap<>();

  public record Session(String serverId, StreamObserver<MonitorMessage> outbound) {}

  /** Returns previous session if replaced. */
  public Session put(String serverId, StreamObserver<MonitorMessage> outbound) {
    Session next = new Session(serverId, outbound);
    return sessions.put(serverId, next);
  }

  public void remove(String serverId, StreamObserver<MonitorMessage> outbound) {
    sessions.computeIfPresent(serverId, (id, cur) ->
        cur.outbound() == outbound ? null : cur);
  }
}
```

On replace: complete/cancel previous observer if possible.

- [ ] **Step 2: Implement `AgentGatewayService` extends `AgentGatewayGrpc.AgentGatewayImplBase`**

`Connect` logic:
1. First message must be `hello`
2. If `!registry.isRegistered(id)` → require valid token via `enrollmentService.validateAndConsume`
3. Else allow empty token
4. `upsertFromHello` + Welcome(`metrics=2`, `heartbeat=10`)
5. Subsequent metrics/heartbeat; ignore unknown for v2.0
6. Reject path: send Reject then `onCompleted`

Peer address: from gRPC `ServerCall` attributes / `Grpc.TRANSPORT_ATTR_REMOTE_ADDR` interceptor if needed; pass into upsert.

- [ ] **Step 3: Unit-test HELLO reject/accept with mocks** (optional but preferred)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: AgentGateway Connect handler and session registry"
```

---

### Task 6: TLS gRPC server lifecycle; delete AgentClient

**Files:**
- Create: `backend/.../gateway/GrpcGatewayServer.java`
- Create: `backend/.../gateway/GatewayTlsProperties.java` (cert/key paths)
- Delete: `backend/.../grpc/AgentClient.java`
- Modify: `HealthController.java` — connection map from `AgentSessionRegistry` / LiveStateCache
- Modify: `application.properties`, `docker-compose.yml` (ports + env)
- Modify: `backend/Dockerfile` if needed to expose 50051

**Interfaces:**
- Env: `GATEWAY_PORT=50051`, `GATEWAY_TLS_CERT`, `GATEWAY_TLS_KEY`, `GATEWAY_ADVERTISE_HOST`
- Server binds TLS via `GrpcSslContexts.forServer(cert, key)`

- [ ] **Step 1: Add GrpcGatewayServer `@Component` implementing `SmartLifecycle` or `ApplicationRunner` + `@PreDestroy`**

```java
Server server = NettyServerBuilder.forPort(port)
  .sslContext(GrpcSslContexts.forServer(certFile, keyFile).build())
  .addService(agentGatewayService)
  .build()
  .start();
```

Fail fast if cert/key missing (no plaintext fallback).

- [ ] **Step 2: Delete AgentClient and fix all imports**

- [ ] **Step 3: Compose**

```yaml
backend:
  ports:
    - "${BACKEND_PORT:-8080}:8080"
    - "${GATEWAY_PORT:-50051}:50051"
  environment:
    GATEWAY_PORT: 50051
    GATEWAY_TLS_CERT: /certs/server.crt
    GATEWAY_TLS_KEY: /certs/server.key
    GATEWAY_ADVERTISE_HOST: ${GATEWAY_ADVERTISE_HOST:-localhost}
  volumes:
    - ./certs:/certs:ro
```

Remove `AGENTS` from backend environment.

- [ ] **Step 4: Build**

```powershell
cd backend; .\gradlew.bat test bootJar
```

Expected: PASS / jar builds

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: TLS Agent Gateway server; remove outbound AgentClient"
```

---

### Task 7: Go agent — client Connect loop

**Files:**
- Create: `agent/internal/gateway/client.go`
- Create: `agent/internal/gateway/client_test.go` (backoff helper test)
- Modify: `agent/cmd/pulsegrid-agent/main.go`
- Delete or stop using: `agent/internal/server/grpc_server.go`

**Interfaces:**
- Env/flags: `SERVER_ID`, `MONITOR_ADDRESS` (host:port), `JOIN_TOKEN` (optional after enroll), `MONITOR_CA_FILE`
- `Run(ctx)` loops: dial TLS → Connect → HELLO → send metrics/heartbeats → on error backoff

- [ ] **Step 1: Backoff helper test**

```go
func TestNextBackoff(t *testing.T) {
  d := time.Second
  for _, want := range []time.Duration{
    time.Second, 2*time.Second, 4*time.Second, 8*time.Second,
    15*time.Second, 30*time.Second, 30*time.Second,
  } {
    if d != want {
      t.Fatalf("got %v want %v", d, want)
    }
    d = nextBackoff(d)
  }
}
```

Implement `nextBackoff` to match series then cap.

- [ ] **Step 2: Implement client**

```go
// Pseudocode structure
conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(creds))
stream, err := pb.NewAgentGatewayClient(conn).Connect(ctx)
stream.Send(&pb.AgentMessage{Payload: &pb.AgentMessage_Hello{Hello: hello}})
msg, err := stream.Recv() // Welcome or Reject
// ticker metrics + heartbeat per Welcome intervals
```

Load CA PEM into `x509.CertPool` for TLS.

- [ ] **Step 3: Rewrite main.go**

Require `SERVER_ID` + `MONITOR_ADDRESS`. No `net.Listen`.

- [ ] **Step 4: Test**

```powershell
cd agent; go test ./...
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: agent dials Monitor AgentGateway with TLS and reconnect"
```

---

### Task 8: Cert bootstrap + install scripts

**Files:**
- Create: `scripts/generate-monitor-certs.sh`
- Modify: `scripts/install-monitor.sh`, `scripts/install-monitor.ps1`
- Modify: `scripts/install-agent.sh`
- Modify: `scripts/run-agent.ps1`, `agent/README.md`
- Modify: `.env.example`
- Modify: demo agents in `docker-compose.yml` (client mode)

**Interfaces:**
- Monitor install writes `certs/ca.crt`, `certs/ca.key`, `certs/server.crt`, `certs/server.key`
- Agent install writes `/etc/pulsegrid/ca.crt`, systemd env: `MONITOR_ADDRESS`, `JOIN_TOKEN`, `MONITOR_CA_FILE`, `SERVER_ID`

- [ ] **Step 1: generate-monitor-certs.sh**

Use OpenSSL to create CA + server cert with SAN DNS/IP from `--public-host`. Idempotent if files exist (or `--force`).

- [ ] **Step 2: Update install-monitor**

Remove `--agents`. Call cert script. Write `.env` without `AGENTS`; set `GATEWAY_ADVERTISE_HOST`, `NEXT_PUBLIC_WS_URL`. Ensure compose publishes 50051.

- [ ] **Step 3: Update install-agent.sh**

```text
--server-id (required)
--monitor host:port (required)
--token (required for first install)
--ca path OR --ca-url / paste fingerprint flow
Remove --port listen
```

Systemd unit example:

```ini
[Service]
Environment=SERVER_ID=kali-01
Environment=MONITOR_ADDRESS=192.168.150.10:50051
Environment=JOIN_TOKEN=pg_join_...
Environment=MONITOR_CA_FILE=/etc/pulsegrid/ca.crt
ExecStart=/usr/local/bin/pulsegrid-agent
Restart=always
```

After first successful run, token may remain in unit (harmless once consumed) or installer documents clearing it — either OK for v2.0.

- [ ] **Step 4: Demo profile**

Demo agents become clients:

```yaml
environment:
  SERVER_ID: web-01
  MONITOR_ADDRESS: backend:50051
  JOIN_TOKEN: ${DEMO_JOIN_TOKEN:-}
  MONITOR_CA_FILE: /certs/ca.crt
```

Seed demo tokens via a small backend bootstrap **only when** `DEMO_ENROLL=true`, or document manual enroll. Prefer: entrypoint script that curls `POST /api/agents/enroll` then starts agent (demo-only).

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: installers use agent-initiated TLS gateway; drop AGENTS"
```

---

### Task 9: Dashboard — Add Agent + empty state

**Files:**
- Modify: `dashboard/components/terminal/HostList.tsx` (or servers list on GUI page)
- Create: `dashboard/components/agents/AddAgentModal.tsx`
- Modify: API client helpers under `dashboard/lib/`
- Modify: i18n `messages/en.json` (+ km/ko keys)

**Interfaces:**
- `POST ${API}/api/agents/enroll` with `{ serverId }`
- Show copyable install command from response
- Empty state when no servers: “No agents connected yet” + Add Agent

- [ ] **Step 1: Add Agent modal**

Fields: agent name/serverId → submit → display token command + Copy button. Optionally show CA download link `GET /api/agents/ca` if you expose CA PEM from backend (recommended: serve `ca.crt` as static from gateway host path or `GET /api/ca.crt` read-only).

Minimal v2.0: install command includes note to copy `ca.crt` from Monitor `certs/ca.crt`; better UX if API serves it.

- [ ] **Step 2: Wire button on servers/hosts UI**

- [ ] **Step 3: Manual UI check against local backend**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: Add Agent enrollment UI for gateway join tokens"
```

---

### Task 10: Docs hard cut + acceptance smoke

**Files:**
- Modify: `docs/INSTALL.md`, `docs/MONITOR.md`, `docs/STATUS.md`, `README.md`
- Modify: `agent/README.md`

- [ ] **Step 1: Rewrite install docs** for Monitor (no agents flag) + Agent (`--monitor` `--token` `--ca`)

- [ ] **Step 2: Document firewall** — only Monitor :50051 inbound for agents

- [ ] **Step 3: Document mTLS as v2.1+ follow-up** (short section)

- [ ] **Step 4: End-to-end smoke**

1. `generate-monitor-certs.sh --public-host <ip>`
2. `docker compose up -d --build`
3. `POST /api/agents/enroll` for `local-01`
4. Run agent with MONITOR_ADDRESS / TOKEN / CA
5. Confirm UI ONLINE + metrics on `/terminal`
6. Stop agent → OFFLINE; start → ONLINE
7. Confirm agent host has nothing listening on 50051

- [ ] **Step 5: Commit**

```bash
git commit -m "docs: Pulsegrid v2.0 agent-initiated install model"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| Agent→Monitor Connect bidi | 1, 5, 7 |
| Remove AGENTS / dial-out / agent listen | 4, 6, 7, 8 |
| Enrollment tokens + Add Agent | 3, 9 |
| LAN CA TLS | 6, 8 |
| Runtime registry ONLINE/OFFLINE | 5, LiveStateCache |
| Reconnect backoff | 7 |
| Kick old session on duplicate | 5 |
| Registered reconnect without token | 5 |
| Installer + compose ports | 8 |
| Docs hard cut + mTLS follow-up note | 10 |
| Metrics → Timescale → WS | 5 (reuse hub/history) |
| Demo agents as clients | 8 |

## Self-review notes

- No dual-mode tasks (matches hard cut)
- Proto message names aligned across Tasks 1/5/7
- `GATEWAY_ADVERTISE_HOST` used by enroll API and installers
- mTLS explicitly deferred to docs only

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-14-pulsegrid-agent-initiated-gateway.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?

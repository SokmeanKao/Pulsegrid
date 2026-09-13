# Pulsegrid — Installation Guide (v2.0)

This guide installs Pulsegrid in two parts:

1. **Monitor** — database, backend API/WebSocket, web UI, and **Agent Gateway** (TLS :50051)
2. **Agent** — metrics collector on each machine (**dials** the Monitor; no inbound agent port)

```text
[ agent on host A ] ──TLS gRPC──┐
[ agent on host B ] ──TLS gRPC──┼──► Monitor Agent Gateway :50051
[ agent on host C ] ──TLS gRPC──┘         ▲
                                          │ browser
                                       http://monitor:3000
```

**Product rule:** agents always initiate the connection. There is no `AGENTS=` list.

Repo: https://github.com/SokmeanKao/Pulsegrid

---

## Prerequisites

### Monitor host

- Docker Engine + Docker Compose v2
- Open ports: **3000** (UI), **8080** (API/WS), **50051** (Agent Gateway TLS)

### Agent host

- Linux: `curl`, root/`sudo`, systemd recommended  
- Windows: built `pulsegrid-agent.exe`
- **Outbound** access to Monitor:50051 (no inbound Pulsegrid port required)

---

## Quick start

### Step 1 — Install Monitor

**Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor.sh \
  | sudo bash -s -- --public-host MONITOR_IP
```

**Windows** (repo cloned, Docker Desktop):

```powershell
.\scripts\install-monitor.ps1 -PublicHost localhost
# or: -PublicHost 192.168.150.10
```

This generates `certs/` (LAN CA + server cert) and starts Compose.

### Step 2 — Open the UI

| URL | Purpose |
|---|---|
| `http://MONITOR_IP:3000/terminal` | Terminal dashboard |
| `http://MONITOR_IP:8080/healthz` | Backend health |
| Agent Gateway | `MONITOR_IP:50051` (TLS) |

### Step 3 — Add Agent

In the UI: **+ Add Agent** → enter `kali-01` → copy install command.

Or manually:

```bash
# copy Monitor certs/ca.crt to the agent host first
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
  | sudo bash -s -- \
      --server-id kali-01 \
      --monitor MONITOR_IP:50051 \
      --token pg_join_xxxxx \
      --ca /path/to/ca.crt
```

**Windows**

```powershell
.\scripts\run-agent.ps1 -ServerId local-01 `
  -Monitor localhost:50051 `
  -Token pg_join_xxxxx `
  -CaFile .\certs\ca.crt
```

The agent appears ONLINE within a few seconds — no Monitor `.env` edit, no restart.

---

## Upgrades from v1.x

v2.0 is a **hard cut**:

1. Upgrade Monitor (new Compose publishes `:50051` TLS; generate `certs/`)
2. Reinstall each agent with `--monitor`, `--token`, and `--ca`
3. Remove old agent firewall allows for inbound `:50051`
4. Delete any leftover `AGENTS=` from `.env`

Registered hosts can later reconnect without a new token (TLS + `serverId`).

---

## Firewall

| Host | Rule |
|---|---|
| Monitor | ALLOW TCP 50051 (agents), 3000/8080 (operators) |
| Agent | outbound to Monitor:50051 only |

---

## Upgrades

**Monitor:** `git pull` + `docker compose up -d --build` (keep `certs/`)

**Agent:** re-run `install-agent.sh` with `--version vX.Y.Z` (registered hosts can reconnect without a new token)

---

## Uninstall

**Agent**

```bash
sudo systemctl disable --now pulsegrid-agent
sudo rm -f /etc/systemd/system/pulsegrid-agent.service /usr/local/bin/pulsegrid-agent
sudo rm -rf /etc/pulsegrid
sudo systemctl daemon-reload
```

**Monitor**

```bash
cd /opt/pulsegrid
sudo docker compose down -v
sudo rm -rf /opt/pulsegrid
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| UI loads, no hosts | Enroll + install agent? Token valid? CA trusted? |
| TLS handshake fails | Agent `--ca` matches Monitor `certs/ca.crt`; SAN includes `--public-host` |
| Rejected INVALID_TOKEN | Generate a fresh token from Add Agent |
| Gateway won't start | `certs/server.crt` + `server.key` present and mounted |

---

## Follow-up (v2.1+)

After registration, Pulsegrid can issue **agent client certificates** and require **mTLS**. v2.0 uses TLS + join tokens for bootstrap; registered hosts reconnect with TLS + `serverId`.

## Related

- Design: `docs/superpowers/specs/2026-09-14-pulsegrid-agent-initiated-gateway-design.md`
- Plan: `docs/superpowers/plans/2026-09-14-pulsegrid-agent-initiated-gateway.md`
- Releases: https://github.com/SokmeanKao/Pulsegrid/releases

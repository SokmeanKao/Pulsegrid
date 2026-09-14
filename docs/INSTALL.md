# Pulsegrid — Installation Guide (v2.2)

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
- Image install also needs **openssl** (Git for Windows includes it)

### Agent host

- Linux: `curl`, root/`sudo`, systemd recommended  
- Windows: built `pulsegrid-agent.exe`
- **Outbound** access to Monitor:50051 (no inbound Pulsegrid port required)

---

## Quick start (no clone — recommended)

Pulls backend + dashboard from GHCR, Timescale, and **nginx** on one HTTP port. No git clone.

**Host ports:** `80` (UI + API + WebSocket) and `50051` (Agent Gateway TLS).

### Windows

```powershell
irm https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor-images.ps1 -OutFile $env:TEMP\pg-mon.ps1
powershell -ExecutionPolicy Bypass -File $env:TEMP\pg-mon.ps1 -PublicHost 192.168.0.230
# If port 80 is busy: add -HttpPort 8080
```

Installs to `%USERPROFILE%\pulsegrid-monitor` by default.

### Linux / WSL / Git Bash

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor-images.sh \
  | bash -s -- --public-host 192.168.0.230
# If port 80 is busy: add --http-port 8080
```

No `sudo` required if your user can run Docker. Default install dir: `~/pulsegrid-monitor`.

Pin a release: `--version v2.2.1` / `-Version v2.2.1`.

### Raw files

```text
https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/docker-compose.monitor.yml
https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/deploy/nginx/default.conf
```

### Open the UI

| URL | Purpose |
|---|---|
| `http://MONITOR_IP/terminal` | Terminal dashboard (port 80) |
| `http://MONITOR_IP/healthz` | Backend health |
| Agent Gateway | `MONITOR_IP:50051` (TLS) |

CA cert: `~/pulsegrid-monitor/certs/ca.crt` (or `%USERPROFILE%\pulsegrid-monitor\certs\ca.crt`).

---

## Alternate: install from source (clone + build)

Use this for local development or if you need to patch Monitor code.

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor.sh \
  | sudo bash -s -- --public-host MONITOR_IP
```

### Windows (repo cloned, Docker Desktop)

```powershell
.\scripts\install-monitor.ps1 -PublicHost localhost
# or: -PublicHost 192.168.150.10
```

This clones/builds from `docker-compose.yml` (`build:` for backend + dashboard).

---

## Add Agent

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

**Monitor (images):** re-run `install-monitor-images` with `--version vX.Y.Z`, or:

```bash
cd ~/pulsegrid-monitor   # or %USERPROFILE%\pulsegrid-monitor
# edit .env PULSEGRID_VERSION=vX.Y.Z
docker compose pull && docker compose up -d
```

**Monitor (source):** `git pull` + `docker compose up -d --build` (keep `certs/`)

**Agent:** re-run `install-agent.sh` with `--version vX.Y.Z` (registered hosts can reconnect without a new token)

## Published images

| Image | Registry |
|---|---|
| Backend | `ghcr.io/sokmeankao/pulsegrid-backend` |
| Dashboard | `ghcr.io/sokmeankao/pulsegrid-dashboard` |
| Agent | `ghcr.io/sokmeankao/pulsegrid-agent` |
| DB | `timescale/timescaledb:latest-pg16` |

Compose (raw): https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/docker-compose.monitor.yml

Also in-repo: [`docker-compose.monitor.yml`](../docker-compose.monitor.yml)

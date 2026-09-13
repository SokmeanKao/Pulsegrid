# Pulsegrid — Installation Guide

This guide installs Pulsegrid in two parts:

1. **Monitor** — database, backend API/WebSocket, and web UI (one server)
2. **Agent** — metrics collector on each machine you want to watch

```text
[ agent on host A ] ──gRPC──┐
[ agent on host B ] ──gRPC──┼──► Monitor (backend + DB + UI)
[ agent on host C ] ──gRPC──┘         ▲
                                      │ browser
                                   http://monitor:3000
```

| Doc | Focus |
|---|---|
| **This page** | Full install walkthrough |
| [MONITOR.md](./MONITOR.md) | Monitor-only details |
| [../agent/README.md](../agent/README.md) | Agent build, deploy, GHCR |

Repo: https://github.com/SokmeanKao/Pulsegrid

---

## Prerequisites

### Monitor host

- Docker Engine + **Docker Compose v2**
- Outbound access to pull images / build
- Open ports (defaults): **3000** (UI), **8080** (API/WS), optionally **5432** (Postgres)

### Agent host

- Linux: `curl`, root/`sudo`, systemd recommended  
  **or** Docker to run the GHCR image  
- Windows: built `pulsegrid-agent.exe` (see agent README)
- Port **50051/tcp** reachable from the Monitor backend (firewall)

---

## Quick start (recommended)

### Step 1 — Install Monitor

**Linux (one-liner)**

Replace `MONITOR_IP` with the IP browsers will use, and list agents you will install (you can leave `--agents` empty and edit later).

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor.sh \
  | sudo bash -s -- \
      --public-host MONITOR_IP \
      --agents "kali-01:192.168.150.131:50051,local-01:host.docker.internal:50051"
```

What it does:

- Clones the repo to `/opt/pulsegrid` (default)
- Writes `.env` (`AGENTS`, `NEXT_PUBLIC_WS_URL`, ports)
- Runs `docker compose up -d --build` (DB + backend + dashboard)

**Windows (from a git clone, Docker Desktop)**

```powershell
cd C:\Dev\Pulsegrid
.\scripts\install-monitor.ps1 -Agents "local-01:host.docker.internal:50051" -PublicHost localhost
```

**From an existing checkout (any OS)**

```bash
cp .env.example .env
# edit AGENTS= and NEXT_PUBLIC_WS_URL=
docker compose up -d --build
```

### Step 2 — Open the UI

| URL | Purpose |
|---|---|
| `http://MONITOR_IP:3000` | Dashboard (GUI) |
| `http://MONITOR_IP:3000/terminal` | Terminal view |
| `http://MONITOR_IP:8080/healthz` | Backend health |

### Step 3 — Install Agent on each target

**Linux one-liner** (GitHub Release binary + systemd):

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
  | sudo bash -s -- --server-id kali-01
```

Pin a release:

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
  | sudo bash -s -- --server-id kali-01 --version v1.2.0
```

**Windows**

```powershell
cd C:\Dev\Pulsegrid
.\scripts\build-agent.ps1
.\scripts\run-agent.ps1 -ServerId local-01
```

**Agent as container (GHCR)**

```bash
docker run -d --name pulsegrid-agent --net=host --restart unless-stopped \
  -e SERVER_ID=kali-01 -e PORT=50051 \
  ghcr.io/sokmeankao/pulsegrid-agent:v1.2.0
```

> Prefer the **host binary/systemd** install for real host metrics. A plain container without host mounts mostly sees container stats.

### Step 4 — Wire agents into Monitor

`AGENTS` format: `id:host:port` comma-separated.

Examples:

```text
# Agent on another LAN machine
AGENTS=kali-01:192.168.150.131:50051

# Agent on the same machine as Docker Desktop / Compose
AGENTS=local-01:host.docker.internal:50051

# Both
AGENTS=kali-01:192.168.150.131:50051,local-01:host.docker.internal:50051
```

Edit `/opt/pulsegrid/.env` (or your clone’s `.env`), then:

```bash
cd /opt/pulsegrid   # or your clone
docker compose up -d --build backend dashboard
```

Rebuild **dashboard** if you changed `NEXT_PUBLIC_WS_URL` (it is baked in at image build time).

---

## Example: Windows Monitor + Kali agent

Assume:

- Monitor PC: `192.168.150.10` (Docker)
- Kali: `192.168.150.131`

**On Monitor (Windows)**

```powershell
.\scripts\install-monitor.ps1 `
  -Agents "kali-01:192.168.150.131:50051" `
  -PublicHost 192.168.150.10
```

**On Kali**

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
  | sudo bash -s -- --server-id kali-01

# allow backend to connect
sudo ufw allow 50051/tcp   # if ufw is enabled
```

**Verify**

```bash
# on Monitor
curl http://192.168.150.10:8080/healthz

# on Kali
systemctl status pulsegrid-agent
```

Open `http://192.168.150.10:3000` — host `kali-01` should appear when connected.

---

## Installer options reference

### `install-monitor.sh`

| Flag | Meaning |
|---|---|
| `--agents LIST` | `id:host:port,...` for backend |
| `--public-host HOST` | IP/DNS used in browser WebSocket URL |
| `--backend-port N` | Host port (default `8080`) |
| `--dashboard-port N` | Host port (default `3000`) |
| `--install-dir PATH` | Default `/opt/pulsegrid` |
| `--branch NAME` | Git branch (default `main`) |
| `--demo` | Also start Compose demo agents |
| `--no-start` | Configure only; do not `compose up` |

### `install-agent.sh`

| Flag | Meaning |
|---|---|
| `--server-id ID` | **Required** host id in the UI |
| `--port N` | gRPC listen port (default `50051`) |
| `--version VER` | Release tag (default: latest), e.g. `v1.2.0` |
| `--no-systemd` | Binary only |
| `--no-start` | Install unit but do not start |

### `install-monitor.ps1`

| Parameter | Meaning |
|---|---|
| `-Agents` | Same as `--agents` |
| `-PublicHost` | Same as `--public-host` |
| `-BackendPort` / `-DashboardPort` | Published ports |
| `-Demo` | Compose `--profile demo` |
| `-NoStart` | Write `.env` only |

---

## Optional: demo agents inside Compose

For a quick smoke test **without** real hosts (metrics are from containers):

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor.sh \
  | sudo bash -s -- --demo --public-host localhost
```

Or:

```bash
AGENTS=web-01:agent-web-01:50051,db-01:agent-db-01:50052 \
  docker compose --profile demo up -d --build
```

---

## Upgrades

**Monitor**

```bash
cd /opt/pulsegrid
sudo git pull
sudo docker compose up -d --build
```

**Agent**

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
  | sudo bash -s -- --server-id kali-01 --version v1.2.0
```

---

## Uninstall

**Agent (systemd)**

```bash
sudo systemctl disable --now pulsegrid-agent
sudo rm -f /etc/systemd/system/pulsegrid-agent.service /usr/local/bin/pulsegrid-agent
sudo systemctl daemon-reload
```

**Monitor**

```bash
cd /opt/pulsegrid
sudo docker compose down
# optional: remove DB volume
sudo docker compose down -v
sudo rm -rf /opt/pulsegrid
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| UI loads, no hosts | `AGENTS` set? Agent listening? `curl :8080/healthz` |
| Browser WS fails | `NEXT_PUBLIC_WS_URL` must use an address the **browser** can reach (not `backend` Docker DNS) |
| Backend cannot reach agent | Firewall on agent host; from Monitor try `Test-NetConnection IP -Port 50051` / `nc -vz IP 50051` |
| Agent on Docker host invisible | Use `host.docker.internal` in `AGENTS` (Compose adds `extra_hosts`) |
| GHCR pull denied | Package visibility on GitHub → Packages, or `docker login ghcr.io` |
| Dashboard still points at old WS URL | Rebuild dashboard after changing `NEXT_PUBLIC_WS_URL` |

---

## Related

- [MONITOR.md](./MONITOR.md) — Monitor package notes  
- [STATUS.md](./STATUS.md) — stack and project status  
- [agent/README.md](../agent/README.md) — agent binary, build, Kali deploy  
- Releases: https://github.com/SokmeanKao/Pulsegrid/releases  

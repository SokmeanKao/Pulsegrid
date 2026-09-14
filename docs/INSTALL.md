# Pulsegrid — Installation Guide (v2.3+)

Two installables:

1. **Monitor** — TimescaleDB + one container (UI + API/WebSocket + Agent Gateway TLS `:50051`)
2. **Agent** — metrics collector on each host (**dials** the Monitor; no inbound agent port)

```text
[ agent on host A ] ──TLS gRPC──┐
[ agent on host B ] ──TLS gRPC──┼──► Monitor Agent Gateway :50051
[ agent on host C ] ──TLS gRPC──┘         ▲
                                          │ browser
                               http://MONITOR_IP:8080/terminal/
```

**Product rule:** agents always initiate the connection. There is no `AGENTS=` list.

Repo: https://github.com/SokmeanKao/Pulsegrid · Latest Monitor image: **`v2.3.3`**

---

## Prerequisites

### Monitor host

- Docker Engine + Docker Compose v2
- Open ports: **8080** (UI/API/WS), **50051** (Agent Gateway TLS)
- No host `openssl` required (certs auto-create inside the container from **v2.3.3**)

### Agent host

- Linux: `curl`, root/`sudo`, systemd recommended
- Windows: `pulsegrid-agent-windows-amd64.exe` from [Releases](https://github.com/SokmeanKao/Pulsegrid/releases)
- **Outbound** TCP to `MONITOR_IP:50051` only

---

## 1. Install Monitor (no clone)

### Clean start (Git Bash / Linux / WSL)

```bash
mkdir -p /e/M-Cross-Lab/pulsegrid-monitor   # or ~/pulsegrid-monitor
cd /e/M-Cross-Lab/pulsegrid-monitor

curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/docker-compose.monitor.yml \
  -o docker-compose.yml

cat > .env <<'EOF'
GATEWAY_ADVERTISE_HOST=192.168.0.230
HTTP_PORT=8080
GATEWAY_PORT=50051
PULSEGRID_VERSION=v2.3.3
PULSEGRID_IMAGE_OWNER=sokmeankao
EOF

docker compose pull
docker compose up -d

# Wait ~10s for first-boot TLS, then export CA for agents
sleep 10
docker compose logs --tail=30 monitor
docker compose cp monitor:/certs/ca.crt ./ca.crt
```

Logs should include `Generating Gateway TLS` (or `Using existing`) and  
`Agent Gateway listening on :50051 (TLS)`.

### Windows PowerShell (one-liner installer)

```powershell
irm https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor-images.ps1 `
  -OutFile $env:TEMP\pg-mon.ps1
powershell -ExecutionPolicy Bypass -File $env:TEMP\pg-mon.ps1 `
  -PublicHost 192.168.0.230 -Version v2.3.3
```

### Open

| URL | Purpose |
|---|---|
| `http://MONITOR_IP:8080/terminal/` | Dashboard |
| `http://MONITOR_IP:8080/healthz` | Health |
| `MONITOR_IP:50051` | Agent Gateway (TLS) |

Containers: **`db`** + **`monitor`**. TLS lives in Docker volume `pulsegrid-certs` (not required on the host).

### Wipe and start over

```bash
cd /path/to/pulsegrid-monitor
docker compose down -v          # removes DB + cert volumes
rm -rf ./*                      # optional: clear install dir
# then re-run the clean-start steps above
```

### If `docker compose pull` says “not found”

GHCR packages default to **private**. Either:

1. GitHub → Packages → `pulsegrid-monitor` → Package settings → **Public**, or  
2. `echo YOUR_PAT | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin` (`read:packages`)

---

## 2. Install Agent

You need three things from the Monitor:

| Item | How to get it |
|---|---|
| **CA** | `ca.crt` from Monitor (`docker compose cp monitor:/certs/ca.crt ./ca.crt`) |
| **Join token** | UI **+ Add Agent**, or `POST /api/agents/enroll` |
| **Monitor address** | `MONITOR_IP:50051` (same IP as `GATEWAY_ADVERTISE_HOST`) |

### A) Enroll (get a token)

**UI (easiest):** open `http://MONITOR_IP:8080/terminal/` → **+ Add Agent** → enter id (e.g. `kali-01`) → copy the install command.

**API:**

```bash
curl -sS -X POST http://MONITOR_IP:8080/api/agents/enroll \
  -H "Content-Type: application/json" \
  -d '{"serverId":"kali-01"}'
```

Response includes `token` (`pg_join_…`), `monitorAddress`, and `installCommand`.

Copy `ca.crt` to the agent host (scp, USB, shared folder, etc.).

### B) Linux agent (recommended)

Run these commands **on the Linux agent host** (Kali, Ubuntu, etc.) — not in Windows Git Bash.

With `ca.crt` present (e.g. `/tmp/ca.crt` or `/etc/pulsegrid/ca.crt`):

```bash
sudo mkdir -p /etc/pulsegrid
sudo cp /path/to/ca.crt /etc/pulsegrid/ca.crt

curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
  | sudo bash -s -- \
      --server-id kali-01 \
      --monitor 192.168.0.230:50051 \
      --token pg_join_REPLACE_ME \
      --ca /etc/pulsegrid/ca.crt \
      --version v2.3.3
```

This installs `/usr/local/bin/pulsegrid-agent`, writes `/etc/pulsegrid/`, and starts `pulsegrid-agent.service`.

Check:

```bash
sudo systemctl status pulsegrid-agent
sudo journalctl -u pulsegrid-agent -f
```

Host should show **ONLINE** in the dashboard within a few seconds.

### C) Windows agent

**Do not** use `install-agent.sh` or `sudo` on Windows. That script is Linux-only.  
Windows Git Bash is **not** PowerShell — paste the matching block below into the matching shell.

**1. On the Monitor host**, export the CA (Git Bash or PowerShell):

```bash
cd /e/M-Cross-Lab/pulsegrid-monitor   # your install dir
docker compose cp monitor:/certs/ca.crt ./ca.crt
```

**2. Install + run the agent**

#### Git Bash (MINGW64)

```bash
mkdir -p /c/pulsegrid
cp /e/M-Cross-Lab/pulsegrid-monitor/ca.crt /c/pulsegrid/ca.crt

curl -fL "https://github.com/SokmeanKao/Pulsegrid/releases/download/v2.3.3/pulsegrid-agent-windows-amd64.exe" \
  -o /c/pulsegrid/pulsegrid-agent.exe

export SERVER_ID=window-01
export MONITOR_ADDRESS=192.168.0.230:50051
export JOIN_TOKEN='pg_join_REPLACE_ME'
export MONITOR_CA_FILE=/c/pulsegrid/ca.crt

/c/pulsegrid/pulsegrid-agent.exe
```

If the download 404s, open [Releases](https://github.com/SokmeanKao/Pulsegrid/releases) and save `pulsegrid-agent-windows-amd64.exe` as `C:\pulsegrid\pulsegrid-agent.exe` manually.

#### PowerShell (Windows PowerShell / Terminal — not Git Bash)

```powershell
New-Item -ItemType Directory -Force -Path C:\pulsegrid | Out-Null
Copy-Item E:\M-Cross-Lab\pulsegrid-monitor\ca.crt C:\pulsegrid\ca.crt -Force

Invoke-WebRequest `
  -Uri "https://github.com/SokmeanKao/Pulsegrid/releases/download/v2.3.3/pulsegrid-agent-windows-amd64.exe" `
  -OutFile C:\pulsegrid\pulsegrid-agent.exe

$env:SERVER_ID = "window-01"
$env:MONITOR_ADDRESS = "192.168.0.230:50051"
$env:JOIN_TOKEN = "pg_join_REPLACE_ME"
$env:MONITOR_CA_FILE = "C:\pulsegrid\ca.crt"
C:\pulsegrid\pulsegrid-agent.exe
```

From a full repo checkout:

```powershell
.\scripts\run-agent.ps1 -ServerId window-01 `
  -Monitor 192.168.0.230:50051 `
  -Token pg_join_REPLACE_ME `
  -CaFile .\ca.crt
```

Leave the terminal open while the agent runs. It should appear **ONLINE** on the dashboard within a few seconds.

### D) Agent container (optional)

```bash
docker run -d --name pulsegrid-agent \
  -e SERVER_ID=box-01 \
  -e MONITOR_ADDRESS=192.168.0.230:50051 \
  -e JOIN_TOKEN=pg_join_REPLACE_ME \
  -e MONITOR_CA_FILE=/certs/ca.crt \
  -v /path/to/ca.crt:/certs/ca.crt:ro \
  ghcr.io/sokmeankao/pulsegrid-agent:v2.3.3
```

Registered hosts can later reconnect **without** a new token (same `SERVER_ID` + CA).

---

## Alternate: Monitor from source (clone + build)

For development only:

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor.sh \
  | sudo bash -s -- --public-host MONITOR_IP
```

Windows (repo cloned):

```powershell
.\scripts\install-monitor.ps1 -PublicHost localhost
```

---

## Firewall

| Host | Rule |
|---|---|
| Monitor | ALLOW TCP **50051** (agents), **8080** (operators) |
| Agent | outbound to Monitor:50051 only |

---

## Upgrades

**Monitor:**

```bash
cd /path/to/pulsegrid-monitor
# edit .env → PULSEGRID_VERSION=vX.Y.Z
docker compose pull && docker compose up -d
```

**Agent:** re-run `install-agent.sh` with `--version vX.Y.Z` (or replace the Windows exe).

---

## Published images

| Image | Registry |
|---|---|
| **Monitor (UI+API+Gateway)** | `ghcr.io/sokmeankao/pulsegrid-monitor` |
| Agent | `ghcr.io/sokmeankao/pulsegrid-agent` |
| DB | `timescale/timescaledb:latest-pg16` |

Compose (raw): https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/docker-compose.monitor.yml

# Pulsegrid Monitor

Control plane: **TimescaleDB + Spring Boot backend + Next.js UI**.

Agents are installed separately ([agent/README.md](../agent/README.md)).

## Quick start

```bash
# Linux one-liner
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor.sh \
  | sudo bash -s -- --agents "kali-01:HOST_IP:50051" --public-host MONITOR_IP
```

```powershell
# Windows (from repo root)
.\scripts\install-monitor.ps1 -Agents "local-01:host.docker.internal:50051"
```

```bash
# From a git checkout
cp .env.example .env   # edit AGENTS=
docker compose up -d --build
```

| URL | Service |
|---|---|
| http://localhost:3000 | Dashboard (GUI) |
| http://localhost:3000/terminal | Terminal view |
| http://localhost:8080/healthz | Backend health |
| ws://localhost:8080/ws/metrics | Live metrics |

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `AGENTS` | `id:host:port,...` — hosts the backend dials |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL the **browser** uses |
| `BACKEND_PORT` / `DASHBOARD_PORT` | Published host ports |

`host.docker.internal` reaches an agent on the Docker host (Desktop / Compose `extra_hosts`).

## Demo agents (optional)

In-compose agents only show **container** metrics — useful for smoke tests:

```bash
AGENTS=web-01:agent-web-01:50051,db-01:agent-db-01:50052 \
  docker compose --profile demo up -d --build
```

## vs Agent

| | Monitor | Agent |
|---|---|---|
| Install | `install-monitor.sh` | `install-agent.sh` |
| Runs | Docker Compose | Binary / systemd / GHCR |
| Role | Store + visualize | Collect host metrics |

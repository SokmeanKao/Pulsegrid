# Pulsegrid Monitor

The Monitor is the control plane: TimescaleDB + Spring Boot (API, WebSocket, **Agent Gateway**) + Next.js UI.

Agents **dial** the Monitor. There is no `AGENTS=` list.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor.sh \
  | sudo bash -s -- --public-host MONITOR_IP
```

Windows:

```powershell
.\scripts\install-monitor.ps1 -PublicHost MONITOR_IP
```

Or from a checkout:

```bash
./scripts/generate-monitor-certs.sh --public-host MONITOR_IP
cp .env.example .env   # set GATEWAY_ADVERTISE_HOST, NEXT_PUBLIC_WS_URL
docker compose up -d --build
```

## Ports

| Port | Service |
|---|---|
| 3000 | Dashboard |
| 8080 | API + WebSocket |
| 50051 | Agent Gateway (TLS) |

## Env (`.env`)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_WS_URL` | Browser WebSocket URL (`ws://MONITOR_IP:8080/ws/metrics`) |
| `NEXT_PUBLIC_API_URL` | Browser API base (`http://MONITOR_IP:8080`) |
| `GATEWAY_ADVERTISE_HOST` | Host shown in Add Agent install commands |
| `GATEWAY_PORT` | Published gateway port (default `50051`) |

TLS material lives in `./certs` (`ca.crt`, `server.crt`, `server.key`) from `scripts/generate-monitor-certs.*`.

## Add agents

Use **+ Add Agent** in the UI, or:

```http
POST /api/agents/enroll
{ "serverId": "kali-01" }
```

Then install the agent with `--monitor`, `--token`, and `--ca`. See [INSTALL.md](./INSTALL.md).

## Demo profile

```bash
docker compose --profile demo up -d --build
```

Demo agents dial `backend:50051` and need join tokens (`DEMO_JOIN_TOKEN_WEB` / `DEMO_JOIN_TOKEN_DB`) plus mounted `certs/`.

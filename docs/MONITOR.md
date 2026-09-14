# Pulsegrid Monitor

Control plane: TimescaleDB + **one** container (Spring Boot API/WS/Agent Gateway + static UI).

Agents **dial** the Monitor. There is no `AGENTS=` list.

## Install (no clone — recommended)

See the full guide: [INSTALL.md](./INSTALL.md).

```bash
mkdir -p pulsegrid-monitor && cd pulsegrid-monitor
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/docker-compose.monitor.yml -o docker-compose.yml
cat > .env <<'EOF'
GATEWAY_ADVERTISE_HOST=YOUR_LAN_IP
HTTP_PORT=8080
GATEWAY_PORT=50051
PULSEGRID_VERSION=v2.3.3
PULSEGRID_IMAGE_OWNER=sokmeankao
EOF
docker compose pull && docker compose up -d
docker compose cp monitor:/certs/ca.crt ./ca.crt
```

TLS is auto-generated on first start into the `pulsegrid-certs` volume (**v2.3.3+**).

## Ports

| Port | Service |
|---|---|
| 8080 | UI + API + WebSocket (default `HTTP_PORT`) |
| 50051 | Agent Gateway (TLS) |

## Env (`.env`)

| Var | Purpose |
|---|---|
| `GATEWAY_ADVERTISE_HOST` | LAN IP/DNS in Add Agent install commands + cert SAN |
| `HTTP_PORT` | Host port for UI/API (default `8080`) |
| `GATEWAY_PORT` | Host port for Agent Gateway (default `50051`) |
| `PULSEGRID_VERSION` | Image tag (e.g. `v2.3.3`) |

## Add agents

1. Copy `ca.crt` from the Monitor (`docker compose cp monitor:/certs/ca.crt ./ca.crt`)
2. **+ Add Agent** in the UI, or:

```http
POST /api/agents/enroll
{ "serverId": "kali-01" }
```

3. Install with `--monitor`, `--token`, and `--ca` — see [INSTALL.md](./INSTALL.md).

## From source (dev)

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-monitor.sh \
  | sudo bash -s -- --public-host MONITOR_IP
```

Or from a checkout: `docker compose up -d --build` (see root `docker-compose.yml`).

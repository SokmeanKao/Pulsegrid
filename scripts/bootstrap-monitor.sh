#!/usr/bin/env bash
# Complete Monitor bootstrap: compose + .env + up (certs auto inside container).
#   curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/bootstrap-monitor.sh \
#     | bash -s -- --public-host 192.168.0.230
set -euo pipefail

REPO="${GITHUB_REPO:-SokmeanKao/Pulsegrid}"
BRANCH="${BRANCH:-main}"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
INSTALL_DIR="${INSTALL_DIR:-${PWD}/pulsegrid-monitor}"
PUBLIC_HOST="${PUBLIC_HOST:-localhost}"
HTTP_PORT="${HTTP_PORT:-8080}"
GATEWAY_PORT="${GATEWAY_PORT:-50051}"
PULSEGRID_VERSION="${PULSEGRID_VERSION:-latest}"
PULSEGRID_IMAGE_OWNER="${PULSEGRID_IMAGE_OWNER:-sokmeankao}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --public-host) PUBLIC_HOST="${2:-}"; shift 2 ;;
    --http-port) HTTP_PORT="${2:-}"; shift 2 ;;
    --gateway-port) GATEWAY_PORT="${2:-}"; shift 2 ;;
    --install-dir) INSTALL_DIR="${2:-}"; shift 2 ;;
    --version) PULSEGRID_VERSION="${2:-}"; shift 2 ;;
    --image-owner) PULSEGRID_IMAGE_OWNER="${2:-}"; shift 2 ;;
    -h|--help)
      echo "Usage: bootstrap-monitor.sh --public-host IP [--http-port 8080] [--install-dir DIR]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

command -v docker >/dev/null || { echo "error: docker required" >&2; exit 1; }
docker compose version >/dev/null || { echo "error: docker compose required" >&2; exit 1; }
command -v curl >/dev/null || { echo "error: curl required" >&2; exit 1; }

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

curl -fsSL "${RAW}/docker-compose.monitor.yml" -o docker-compose.yml
cat >.env <<EOF
GATEWAY_ADVERTISE_HOST=${PUBLIC_HOST}
HTTP_PORT=${HTTP_PORT}
GATEWAY_PORT=${GATEWAY_PORT}
PULSEGRID_VERSION=${PULSEGRID_VERSION}
PULSEGRID_IMAGE_OWNER=${PULSEGRID_IMAGE_OWNER}
EOF

echo "→ Wrote ${INSTALL_DIR}/docker-compose.yml and .env"
docker compose pull
docker compose up -d

HTTP_DISP="${PUBLIC_HOST}:${HTTP_PORT}"
[[ "$HTTP_PORT" == "80" ]] && HTTP_DISP="${PUBLIC_HOST}"

cat <<EOF

✓ Pulsegrid Monitor starting (TLS certs auto-generated in volume)

  Dashboard:     http://${HTTP_DISP}/terminal/
  Health:        http://${HTTP_DISP}/healthz
  Agent Gateway: ${PUBLIC_HOST}:${GATEWAY_PORT}
  Install dir:   ${INSTALL_DIR}

Export CA for agents:
  docker compose cp monitor:/certs/ca.crt ./ca.crt

EOF

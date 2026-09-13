#!/usr/bin/env bash
# Pulsegrid agent one-line installer (Linux).
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
#     | sudo bash -s -- --server-id kali-01
set -euo pipefail

REPO="${GITHUB_REPO:-SokmeanKao/Pulsegrid}"
VERSION="${VERSION:-}"
SERVER_ID="${SERVER_ID:-}"
PORT="${PORT:-50051}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BIN_NAME="pulsegrid-agent"
NO_SYSTEMD=0
START=1

usage() {
  cat <<'EOF'
Install pulsegrid-agent from GitHub Releases.

Options:
  --server-id ID   Required. Host id reported to the backend (e.g. kali-01)
  --port N         gRPC listen port (default 50051)
  --version VER    Release tag (default: latest). Example: v1.2.0
  --no-systemd     Install binary only; skip systemd unit
  --no-start       Install + enable unit but do not start yet
  -h, --help       Show help

Env:
  GITHUB_REPO, VERSION, SERVER_ID, PORT, INSTALL_DIR
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-id) SERVER_ID="${2:-}"; shift 2 ;;
    --port) PORT="${2:-}"; shift 2 ;;
    --version) VERSION="${2:-}"; shift 2 ;;
    --no-systemd) NO_SYSTEMD=1; shift ;;
    --no-start) START=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$SERVER_ID" ]]; then
  echo "error: --server-id is required" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "error: run as root (sudo)" >&2
  exit 1
fi

arch="$(uname -m)"
case "$arch" in
  x86_64|amd64) GOARCH="amd64" ;;
  aarch64|arm64) GOARCH="arm64" ;;
  *) echo "error: unsupported arch: $arch" >&2; exit 1 ;;
esac

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
if [[ "$os" != "linux" ]]; then
  echo "error: this installer supports Linux only (got $os)" >&2
  exit 1
fi

asset="pulsegrid-agent-linux-${GOARCH}"

api="https://api.github.com/repos/${REPO}/releases"
if [[ -n "$VERSION" ]]; then
  release_url="${api}/tags/${VERSION}"
else
  release_url="${api}/latest"
fi

echo "→ Fetching release metadata (${VERSION:-latest})…"
json="$(curl -fsSL -H 'Accept: application/vnd.github+json' "$release_url")"
tag="$(printf '%s\n' "$json" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')"
download_url="$(printf '%s\n' "$json" | grep -o "https://[^\"]*/${asset}\"" | head -n1 | tr -d '"')"

if [[ -z "$download_url" ]]; then
  if [[ -z "$tag" && -n "$VERSION" ]]; then tag="$VERSION"; fi
  if [[ -z "$tag" ]]; then
    echo "error: could not resolve latest release for ${REPO}" >&2
    exit 1
  fi
  download_url="https://github.com/${REPO}/releases/download/${tag}/${asset}"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "→ Downloading ${download_url}"
curl -fsSL -o "${tmp}/${BIN_NAME}" "$download_url"
chmod +x "${tmp}/${BIN_NAME}"

install -d "$INSTALL_DIR"
install -m 0755 "${tmp}/${BIN_NAME}" "${INSTALL_DIR}/${BIN_NAME}"
echo "→ Installed ${INSTALL_DIR}/${BIN_NAME} (${tag:-unknown})"

if [[ "$NO_SYSTEMD" -eq 1 ]]; then
  echo "→ Skipping systemd (--no-systemd)"
  echo "  SERVER_ID=${SERVER_ID} PORT=${PORT} ${INSTALL_DIR}/${BIN_NAME}"
  exit 0
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "→ systemctl not found; binary installed only"
  echo "  SERVER_ID=${SERVER_ID} PORT=${PORT} ${INSTALL_DIR}/${BIN_NAME}"
  exit 0
fi

unit="/etc/systemd/system/pulsegrid-agent.service"
cat >"$unit" <<EOF
[Unit]
Description=Pulsegrid metrics agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=SERVER_ID=${SERVER_ID}
Environment=PORT=${PORT}
ExecStart=${INSTALL_DIR}/${BIN_NAME}
Restart=on-failure
RestartSec=2
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pulsegrid-agent.service
if [[ "$START" -eq 1 ]]; then
  systemctl restart pulsegrid-agent.service
  systemctl --no-pager --full status pulsegrid-agent.service || true
fi

echo "✓ pulsegrid-agent ready (SERVER_ID=${SERVER_ID} PORT=${PORT})"
echo "  Point backend AGENTS at this host: ${SERVER_ID}:<host-ip>:${PORT}"

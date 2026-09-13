#!/usr/bin/env bash
# Pulsegrid agent one-line installer (Linux).
# Usage:
#   curl -fsSL …/install-agent.sh | sudo bash -s -- \
#     --server-id kali-01 --monitor 192.168.150.10:50051 --token pg_join_… --ca /path/ca.crt
set -euo pipefail

REPO="${GITHUB_REPO:-SokmeanKao/Pulsegrid}"
VERSION="${VERSION:-}"
SERVER_ID="${SERVER_ID:-}"
MONITOR_ADDRESS="${MONITOR_ADDRESS:-}"
JOIN_TOKEN="${JOIN_TOKEN:-}"
CA_SRC="${CA_SRC:-}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BIN_NAME="pulsegrid-agent"
CONF_DIR="/etc/pulsegrid"
NO_SYSTEMD=0
START=1

usage() {
  cat <<'EOF'
Install pulsegrid-agent from GitHub Releases (agent-initiated TLS client).

Options:
  --server-id ID     Required. Host id shown in the UI (e.g. kali-01)
  --monitor HOST:P   Required. Monitor Agent Gateway (e.g. 192.168.150.10:50051)
  --token TOKEN      Required for first enrollment (pg_join_…)
  --ca PATH          Required. Path to Monitor ca.crt to install
  --version VER      Release tag (default: latest)
  --no-systemd       Install binary only
  --no-start         Install + enable unit but do not start
  -h, --help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-id) SERVER_ID="${2:-}"; shift 2 ;;
    --monitor) MONITOR_ADDRESS="${2:-}"; shift 2 ;;
    --token) JOIN_TOKEN="${2:-}"; shift 2 ;;
    --ca) CA_SRC="${2:-}"; shift 2 ;;
    --version) VERSION="${2:-}"; shift 2 ;;
    --no-systemd) NO_SYSTEMD=1; shift ;;
    --no-start) START=0; shift ;;
    --port)
      echo "error: --port was removed in v2.0 (agent no longer listens)" >&2
      exit 1
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$SERVER_ID" || -z "$MONITOR_ADDRESS" || -z "$JOIN_TOKEN" || -z "$CA_SRC" ]]; then
  echo "error: --server-id, --monitor, --token, and --ca are required" >&2
  usage >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "error: run as root (sudo)" >&2
  exit 1
fi

if [[ ! -f "$CA_SRC" ]]; then
  echo "error: CA file not found: $CA_SRC" >&2
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
install -d "$CONF_DIR"
install -m 0644 "$CA_SRC" "${CONF_DIR}/ca.crt"
echo "→ Installed ${INSTALL_DIR}/${BIN_NAME} (${tag:-unknown})"
echo "→ Installed ${CONF_DIR}/ca.crt"

if [[ "$NO_SYSTEMD" -eq 1 ]]; then
  echo "→ Skipping systemd (--no-systemd)"
  echo "  SERVER_ID=${SERVER_ID} MONITOR_ADDRESS=${MONITOR_ADDRESS} ${INSTALL_DIR}/${BIN_NAME}"
  exit 0
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "→ systemctl not found; binary installed only"
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
Environment=MONITOR_ADDRESS=${MONITOR_ADDRESS}
Environment=JOIN_TOKEN=${JOIN_TOKEN}
Environment=MONITOR_CA_FILE=${CONF_DIR}/ca.crt
ExecStart=${INSTALL_DIR}/${BIN_NAME}
Restart=always
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

echo "✓ pulsegrid-agent ready (SERVER_ID=${SERVER_ID} → ${MONITOR_ADDRESS})"
echo "  Agent initiates TLS connection; no inbound port required on this host."

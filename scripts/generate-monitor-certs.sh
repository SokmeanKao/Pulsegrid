#!/usr/bin/env bash
# Generate LAN CA + Agent Gateway server certificate for Pulsegrid Monitor.
# Usage: scripts/generate-monitor-certs.sh --public-host 192.168.150.10 [--force]
set -euo pipefail

# Git Bash (MSYS) converts /CN=... into a Windows path — disable that.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

PUBLIC_HOST="${PUBLIC_HOST:-localhost}"
OUT_DIR="${OUT_DIR:-}"
FORCE=0

usage() {
  cat <<'EOF'
Options:
  --public-host HOST   IP or DNS for certificate SAN (default: localhost)
  --out-dir PATH       Output directory (default: <repo>/certs)
  --force              Overwrite existing certs
  -h, --help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --public-host) PUBLIC_HOST="${2:-}"; shift 2 ;;
    --out-dir) OUT_DIR="${2:-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${OUT_DIR:-${ROOT}/certs}"
mkdir -p "$OUT_DIR"

if [[ -f "${OUT_DIR}/server.crt" && "$FORCE" -ne 1 ]]; then
  echo "→ Certs already exist in ${OUT_DIR} (use --force to regenerate)"
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "error: openssl is required" >&2
  exit 1
fi

echo "→ Generating CA + server cert for SAN=${PUBLIC_HOST} in ${OUT_DIR}"

openssl genrsa -out "${OUT_DIR}/ca.key" 4096
openssl req -x509 -new -nodes -key "${OUT_DIR}/ca.key" -sha256 -days 3650 \
  -subj "/CN=Pulsegrid Local CA" -out "${OUT_DIR}/ca.crt"

openssl genrsa -out "${OUT_DIR}/server.key" 2048
openssl req -new -key "${OUT_DIR}/server.key" -subj "/CN=${PUBLIC_HOST}" -out "${OUT_DIR}/server.csr"

SAN="DNS:localhost,IP:127.0.0.1"
if [[ "$PUBLIC_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  SAN="${SAN},IP:${PUBLIC_HOST}"
else
  SAN="${SAN},DNS:${PUBLIC_HOST}"
fi

# Avoid process substitution (<(...)) for Git Bash / older bash compatibility.
EXT_FILE="${OUT_DIR}/san.ext"
printf "subjectAltName=%s\nextendedKeyUsage=serverAuth\n" "$SAN" >"$EXT_FILE"

openssl x509 -req -in "${OUT_DIR}/server.csr" -CA "${OUT_DIR}/ca.crt" -CAkey "${OUT_DIR}/ca.key" \
  -CAcreateserial -out "${OUT_DIR}/server.crt" -days 825 -sha256 \
  -extfile "$EXT_FILE"

rm -f "${OUT_DIR}/server.csr" "${OUT_DIR}/ca.srl" "$EXT_FILE"
chmod 644 "${OUT_DIR}/ca.crt" "${OUT_DIR}/server.crt" 2>/dev/null || true
chmod 600 "${OUT_DIR}/ca.key" "${OUT_DIR}/server.key" 2>/dev/null || true

FP="$(openssl x509 -in "${OUT_DIR}/ca.crt" -noout -fingerprint -sha256 | cut -d= -f2)"
echo "✓ Wrote ${OUT_DIR}/{ca.crt,ca.key,server.crt,server.key}"
echo "  CA SHA256 fingerprint: ${FP}"

#!/usr/bin/env bash
# Pulsegrid Monitor container entrypoint — auto-create Gateway TLS if missing.
set -euo pipefail

CERT_DIR="${GATEWAY_CERT_DIR:-/certs}"
HOST="${GATEWAY_ADVERTISE_HOST:-localhost}"
CERT="${GATEWAY_TLS_CERT:-${CERT_DIR}/server.crt}"
KEY="${GATEWAY_TLS_KEY:-${CERT_DIR}/server.key}"
CA_CERT="${GATEWAY_CA_CERT:-${CERT_DIR}/ca.crt}"
CA_KEY="${CERT_DIR}/ca.key"

mkdir -p "$CERT_DIR"

if [[ ! -f "$CERT" || ! -f "$KEY" || ! -f "$CA_CERT" ]]; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "error: TLS material missing and openssl is not available in the image" >&2
    exit 1
  fi
  echo "→ Generating Monitor Gateway TLS for SAN=${HOST} in ${CERT_DIR}"
  openssl genrsa -out "$CA_KEY" 4096
  openssl req -x509 -new -nodes -key "$CA_KEY" -sha256 -days 3650 \
    -subj "/CN=Pulsegrid Local CA" -out "$CA_CERT"
  openssl genrsa -out "$KEY" 2048
  openssl req -new -key "$KEY" -subj "/CN=${HOST}" -out "${CERT_DIR}/server.csr"

  SAN="DNS:localhost,IP:127.0.0.1"
  if [[ "$HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    SAN="${SAN},IP:${HOST}"
  else
    SAN="${SAN},DNS:${HOST}"
  fi
  printf "subjectAltName=%s\nextendedKeyUsage=serverAuth\n" "$SAN" >"${CERT_DIR}/san.ext"
  openssl x509 -req -in "${CERT_DIR}/server.csr" -CA "$CA_CERT" -CAkey "$CA_KEY" \
    -CAcreateserial -out "$CERT" -days 825 -sha256 -extfile "${CERT_DIR}/san.ext"
  rm -f "${CERT_DIR}/server.csr" "${CERT_DIR}/ca.srl" "${CERT_DIR}/san.ext"
  chmod 644 "$CA_CERT" "$CERT" 2>/dev/null || true
  chmod 600 "$CA_KEY" "$KEY" 2>/dev/null || true
  echo "✓ Wrote ${CERT_DIR}/{ca.crt,server.crt,server.key}"
else
  echo "→ Using existing TLS material in ${CERT_DIR}"
fi

export GATEWAY_TLS_CERT="$CERT"
export GATEWAY_TLS_KEY="$KEY"
export GATEWAY_CA_CERT="$CA_CERT"

exec java -jar /app/app.jar

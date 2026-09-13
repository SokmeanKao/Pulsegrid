# Pulsegrid Agent — Release & Install Design

**Date:** 2026-09-13  
**Status:** Approved  
**Repo:** https://github.com/SokmeanKao/Pulsegrid

## Goals

1. Versioned Git tags (`vX.Y.Z`) produce GitHub Releases with agent binaries.
2. One-line install on a target Linux host (Kali/Debian/RHEL-ish).
3. Container image published to GHCR for `docker pull` / `docker run`.
4. RPM packaging deferred (phase 2); leave hooks in docs.

## Version source

- Agent reports `AgentVersion` in `agent/internal/metrics/collector.go` (currently `1.2.0`).
- Git tag must match: `v1.2.0`.
- Release workflow embeds version via `-ldflags "-X …Version=…"`.

## Artifacts per tag

| Artifact | Notes |
|---|---|
| `pulsegrid-agent-linux-amd64` | Primary Kali/server target |
| `pulsegrid-agent-linux-arm64` | Optional; build if cheap |
| `pulsegrid-agent-windows-amd64.exe` | Dev hosts |
| checksums `SHA256SUMS` | Attached to release |
| `ghcr.io/sokmeankao/pulsegrid-agent:v1.2.0` and `:latest` | From `agent/Dockerfile` |

## One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh | sudo bash -s -- --server-id HOST_ID
```

Script behavior:

1. Detect arch (`amd64` / `arm64`).
2. Download latest (or `--version vX.Y.Z`) release binary from GitHub Releases.
3. Install to `/usr/local/bin/pulsegrid-agent`.
4. Write systemd unit `pulsegrid-agent.service` with `SERVER_ID` / `PORT`.
5. Enable + start service (unless `--no-systemd`).

Env overrides: `SERVER_ID`, `PORT`, `VERSION`, `GITHUB_REPO` (default `SokmeanKao/Pulsegrid`).

## GHCR

On tag push:

```text
ghcr.io/<owner>/pulsegrid-agent:<tag>
ghcr.io/<owner>/pulsegrid-agent:latest
```

Run example:

```bash
docker run --rm --net=host \
  -e SERVER_ID=kali-01 -e PORT=50051 \
  ghcr.io/sokmeankao/pulsegrid-agent:v1.2.0
```

## CI

`.github/workflows/release-agent.yml`:

- Trigger: `push` tags `v*`
- Build matrix: linux/amd64, linux/arm64, windows/amd64
- Upload release assets via `softprops/action-gh-release`
- Build+push Docker image to GHCR (`packages: write`)

## Out of scope (phase 2)

- `.rpm` / `.deb` packages and apt/yum repos
- Signed commits / cosign image signing
- Auto-upgrade daemon

## Security

- Never ship host passwords; `linux-kali.txt` stays gitignored.
- Install script uses HTTPS GitHub APIs / release assets only.

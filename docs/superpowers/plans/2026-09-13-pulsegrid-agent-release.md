# Agent Release & One-line Install — Implementation Plan

> **For agentic workers:** Execute task-by-task. Checkbox steps.

**Goal:** Ship `v1.2.0` tag workflow that publishes binaries + GHCR image and a one-line Linux install script.

**Tech:** GitHub Actions, Go cross-compile, GHCR, systemd install script.

---

### Task 1: Install script

**Files:**
- Create: `scripts/install-agent.sh`
- Modify: `agent/README.md`, root `README.md`

**Steps:**
1. Write bash installer (arch detect, download release, install binary, systemd unit).
2. Document one-liner with `SERVER_ID`.

### Task 2: Version ldflags

**Files:**
- Modify: `agent/internal/metrics/collector.go` (export settable version var)
- Modify: `agent/cmd/pulsegrid-agent/main.go` if needed

**Steps:**
1. Change `AgentVersion` to a var defaulting to `1.2.0` so `-ldflags -X` can override.

### Task 3: Release workflow

**Files:**
- Create: `.github/workflows/release-agent.yml`

**Steps:**
1. On `v*` tags: build binaries, SHA256SUMS, GitHub Release, GHCR push.

### Task 4: Tag & push

**Steps:**
1. Commit release files (no secrets).
2. Tag `v1.2.0`, push `main` + tag.
3. Confirm Actions run (requires `gh` or browser).

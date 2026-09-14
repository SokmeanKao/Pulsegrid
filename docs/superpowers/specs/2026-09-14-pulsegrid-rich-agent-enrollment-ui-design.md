# Pulsegrid — Rich Agent Enrollment UI Design

**Date:** 2026-09-14  
**Status:** Approved / implemented  
**Scope:** Enrich **+ Add Agent** modal + enroll landing page + API command variants + shadcn QR

## Goal

Operators enroll agents from the Monitor UI without reading install docs: pick OS, copy the right commands, download CA, and optionally scan a QR (default short enroll URL; toggle to encode the Linux one-liner).

## Non-goals

- Changing TLS / gateway auth model
- Multi-user RBAC on enroll
- Auto-install via QR (scan only surfaces the page or command text)
- Replacing systemd / Windows service installers

## Current state

- UI: `AddAgentModal` + Hosts **+ Add Agent** → `POST /api/agents/enroll`
- API returns `token`, `monitorAddress`, single Linux `installCommand`, plus `GET /api/agents/ca.crt`
- Dashboard is **static export** (`output: "export"`) — enroll UI must be client-side pages under `/enroll/`

## Design

### 1. API — enriched enroll response

`POST /api/agents/enroll` body unchanged: `{ "serverId": "kali-01" }`.

Response (keep `installCommand` as alias of `commands.linux` for back-compat):

```json
{
  "serverId": "kali-01",
  "token": "pg_join_…",
  "expiresAt": "…",
  "monitorAddress": "192.168.0.230:50051",
  "caUrl": "http://192.168.0.230:8080/api/agents/ca.crt",
  "enrollUrl": "http://192.168.0.230:8080/enroll/?s=kali-01&t=pg_join_…",
  "installCommand": "<same as commands.linux>",
  "commands": {
    "linux": "curl -fsSL … | sudo bash -s -- --server-id … --monitor … --token … --ca /etc/pulsegrid/ca.crt --version v2.3.3",
    "windowsGitBash": "mkdir -p /c/pulsegrid && …",
    "windowsPowerShell": "New-Item …; $env:SERVER_ID=…; …",
    "docker": "docker run -d … ghcr.io/sokmeankao/pulsegrid-agent:…"
  }
}
```

Notes:

- `caUrl` / `enrollUrl` use `http://{GATEWAY_ADVERTISE_HOST}:{HTTP_PORT or 8080}` (new optional `GATEWAY_HTTP_PORT` / reuse existing advertise host; default public HTTP port **8080**).
- Agent image/script version: env `PULSEGRID_AGENT_VERSION` defaulting to a pinned tag (e.g. `v2.3.3`) or `latest`.
- Windows commands assume operator already has / downloads `ca.crt` via `caUrl` (also linked in UI). Git Bash block mirrors [docs/INSTALL.md](../../INSTALL.md).
- No new DB table for v1: short URL carries `s` + `t` query params (token already shared in install commands). Opaque session IDs deferred.

### 2. Add Agent modal (dashboard)

Flow:

1. Enter **server id** → **Generate**
2. Result panel:
   - Summary: server id, monitor address, token (masked with reveal + copy), expires
   - **Download ca.crt** button (`caUrl`)
   - **OS tabs:** Linux | Windows (Git Bash) | Windows (PowerShell) | Docker  
     Each tab: numbered steps (1 download CA, 2 run command) + monospace command + **Copy**
   - **QR section** (shadcn-styled):
     - Default payload: `enrollUrl`
     - Toggle: “Encode Linux install command instead”
     - Caption explaining scan → open enroll page / paste command on Linux host

Keep terminal aesthetic (existing CSS vars); use shadcn primitives where they already fit (`Button`, `Tabs`, `Switch`/`Toggle`, dialog shell). Add missing shadcn pieces as needed.

### 3. Enroll landing page

Static route: `dashboard/app/enroll/page.tsx` → exported as `/enroll/`.

- Reads `s` (serverId) and `t` (token) from query string
- If missing: short error + link back to terminal
- If present: same OS tabs + CA download + QR (same component as modal), rebuilds command strings client-side from `s`/`t` + runtime config (`loadPulsegridConfig` / advertise host from `/pulsegrid-config`)
- Optional: `GET` nothing beyond config + ca; token is not re-fetched (already in URL)

### 4. QR component (shadcn)

- Add a small UI wrapper `components/ui/qr-code.tsx` following shadcn patterns (border, muted bg, size prop)
- Render with a maintained QR lib (e.g. `qrcode.react` or equivalent) — shadcn has no first-party QR primitive; wrap the lib in our `QrCode` component so call sites stay “shadcn-style”
- Props: `value: string`, `size?: number`, accessible `alt` / `aria-label`

### 5. Runtime config

Ensure `/pulsegrid-config` (or existing loader) exposes enough to build `enrollUrl` and `caUrl` in the browser when the enroll page reconstructs commands (public host + http port). Backend enroll response remains authoritative inside the modal.

## UX copy (tabs)

| Tab | Steps (short) |
|---|---|
| Linux | Download CA → save as `/etc/pulsegrid/ca.crt` → run one-liner |
| Windows Git Bash | Download CA → `curl` exe → `export` env → run exe |
| Windows PowerShell | Download CA → download exe → `$env:…` → run exe |
| Docker | Download/mount CA → `docker run …` |

## Security / ops

- Join tokens remain single-use / 24h as today
- QR and URLs contain secrets — warn in UI: “Treat like a password; expires in 24h”
- CA download stays unauthenticated (LAN CA) as today

## Acceptance

1. From Hosts → **+ Add Agent**, operator can enroll and copy Linux / Git Bash / PowerShell / Docker commands  
2. CA downloads from the modal  
3. QR defaults to `enrollUrl`; toggle switches to Linux one-liner and redraws  
4. Opening `enrollUrl` on another device shows the same OS tabs + CA + QR  
5. Existing `installCommand` field still present for any old clients  

## Out of scope follow-ups

- Opaque enroll session IDs (hide token from URL)  
- Deep-link Windows `ms-appinstaller` / one-click  
- i18n of enroll strings  

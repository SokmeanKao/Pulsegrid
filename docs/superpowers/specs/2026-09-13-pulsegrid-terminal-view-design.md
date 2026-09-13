# Pulsegrid — Terminal View (btop-inspired TUI) Design

**Date:** 2026-09-13  
**Status:** Draft for review  
**Product name:** **Terminal View** (not a literal terminal emulator)

## Intent

Give Pulsegrid a dense, keyboard-first **TUI-style web UI** for engineers / NOC, while keeping the existing **Dashboard (GUI)** for everyday operators.

```text
View switch:  [ GUI | TUI ]
Preference:   localStorage
```

Both modes consume the **same metrics data layer** (WebSocket live + REST history). Do not duplicate the socket client.

## Non-goals

- Literal xterm / PTY / remote shell
- Process kill / reboot / remediation controls
- Replacing shadcn Dashboard View

## Visual system

| Token | Value |
|---|---|
| Background | `#080b0d` |
| Panel | `#0d1115` |
| Border | muted gray |
| Primary text | light gray |
| Secondary | gray |
| Healthy | green |
| Warning | yellow |
| Critical | red |
| Info | cyan |
| Offline | gray |

- **Font:** JetBrains Mono (Terminal View only; Maven Pro remains for GUI)
- **Panels:** hard box-drawing borders (`┌─┐`), `border-radius` ≈ 2px max, no SaaS card chrome
- **Charts:** ECharts sparklines — minimal axes, no legend clutter, terminal-like density

## Layout (host overview)

```text
Header KPIs + LIVE clock
├─ Host list (left)  │  CPU panel
│                    │  Memory panel
├─ Summary bars      ├─ Network │ Disks
├─ Process table (full width)
└─ Footer: view keys + shortcuts
```

## Interaction

| Key | Action |
|---|---|
| ↑ ↓ | Select host |
| Enter | Open host |
| Esc | Back |
| 1–6 | Overview / CPU / Memory / Disk / Network / Processes |
| a / e | Alerts / Events (when available) |
| / | Search |
| r | Refresh |
| t | Toggle GUI/TUI |
| ? | Shortcut help |

Process table: sort by `c`/`m`/`p`, filter with `/` — **no kill**.

## Data requirements

**Works with v2.1 envelope today:** global CPU, memory (used/available/cache/swap), disks[], networks[] rates, top_processes[], health/connection from live cache.

**Agent enhancement (follow-up):** per-core CPU percentages for btop-style CPU0…CPUn bars (`CpuMetrics.per_core_percent[]` or equivalent).

## Code structure

```text
app/terminal/...
components/terminal/*   (shell, panels, ascii-progress, shortcuts)
lib/terminal/{theme,format,keyboard}.ts
hooks/useKeyboardNavigation.ts
```

Shared: existing `useMetricsSocket` / future metrics store — GUI and TUI both subscribe.

## Phasing

| Slice | Scope |
|---|---|
| **TV-1** | Route `/terminal`, shell + theme + GUI/TUI toggle, host list, overview panels from current envelope, keyboard nav basics |
| **TV-2** | Per-host deep panels (CPU/mem/disk/net/processes), sparkline polish, shortcut help modal |
| **TV-3** | Alerts/Events terminal panels; per-core CPU after agent field lands |
| **TV-4** | Grouped hosts by environment/tags; remember layout preferences |

## Relationship to roadmap

- Complements **v2.2** Dashboard UI rather than blocking it
- Can ship **TV-1** in parallel with Overview/Servers GUI work
- Uses v2.1 LIVE path; history ranges remain REST (not WS)

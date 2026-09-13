# Pulsegrid Terminal Console — Customizable Observability UX

**Date:** 2026-09-13  
**Status:** Approved direction (implement incrementally)  
**Supersedes (partial):** fixed full-page GridStack on Terminal from TV-1

## Principle

**btop-inspired visual identity** + **Grafana/Netdata-style workflow** — not a literal btop clone and not a generic SaaS card grid.

```text
Fixed chrome (never GridStack):
  Top status/command bar
  Left host navigator

Customizable canvas (GridStack only):
  Widgets for selected host / scope
```

## Modes

| Mode | Behavior |
|---|---|
| **VIEW** | Widgets locked; charts interactive; no resize handles |
| **EDIT LAYOUT** | Drag via title-bar handle; resize; add/remove; reset; save preset |

Drag/resize must **not** stay permanently enabled.

## GridStack (canvas only)

- 12 / 6 / 1 columns (desktop / tablet / mobile)
- `cellHeight` ~32, `margin` 4–6, `float: true`
- Drag handle: `.widget-drag-handle` (edit mode only)
- Persist layout JSON in `localStorage` first; backend per-user later

## Phased delivery

1. Canvas-only GridStack + fixed chrome + VIEW/EDIT  
2. `TerminalWidget` wrapper  
3. Persist layout  
4. Presets  
5. Add-widget modal  
6. Denser CPU/Mem/Disk/Net content  
7. Process search/sort/tree/detail  
8. Alerts/Events  
9. Historical LIVE/5m/1h…  
10. Backend layout storage  
11. Containers/services/sensors  

P0 now: steps 1–3 (+ denser panel content where cheap).

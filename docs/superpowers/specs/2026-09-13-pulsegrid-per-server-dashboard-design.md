# Pulsegrid — Per-Server Dashboard Configuration

**Date:** 2026-09-13  
**Status:** P0 implemented (localStorage)  
**Implements (P0):** Per-server GridStack layouts in localStorage + presets + Add Widget

## Principle

No single fixed layout for all hosts. Each server has its own dashboard configuration (widgets, positions, settings).

```text
USER (+ later)
  +
SERVER
  ↓
DASHBOARD(s)     ← P1: multiple named dashboards
  ↓
WIDGETS + GridStack geometry + config_json
```

## P0 (this slice)

- Layout key: `pulsegrid.dashboard.terminal.{serverId}` (localStorage)
- Remount / reload GridStack when selected host changes
- Presets: General, Processes, Minimal, Empty
- Add Widget modal (system / storage / network / processes)
- Per-widget `config` object (reserved; network interface etc. later)
- Edit layout still VIEW / EDIT; persist on drag/resize (debounced via existing GridStack save)

## P1

- Multiple dashboards per server (`Overview`, `Performance`, …)
- Backend tables: `dashboard_layouts`, `dashboard_widgets`
- Per-user + per-server selection
- Widget settings UI (interface picker, history window)

## P2

- Capability-aware Add Widget catalog
- Service / Docker / DB-specific widget types

## Data shape (P0)

```json
{
  "serverId": "kali-01",
  "preset": "general",
  "widgets": [
    {
      "id": "cpu-1",
      "type": "cpu",
      "x": 0, "y": 0, "w": 6, "h": 6,
      "config": {}
    }
  ]
}
```

## GridStack flow

```text
Select host → load dashboard JSON → GridStack init
drag/resize → debounce → save dashboard JSON
```

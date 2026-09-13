# Pulsegrid — User Preferences (Theme + Language)

**Date:** 2026-09-13  
**Status:** P0 implemented (localStorage)  
**Separation:** User prefs ≠ per-machine GridStack layouts

## Model

```text
User preferences          Machine dashboards
├── theme                 ├── serverId → widgets
├── locale                └── localStorage pulsegrid.dashboard.terminal.{id}
└── (later timezone)
```

## Storage (P0)

- `pulsegrid.theme` → `light` | `dark` | `system` (via next-themes)
- `pulsegrid.locale` → `en` | `km` | `ko`

## Stack

- Theme: `next-themes`
- i18n: `next-intl` (client provider; no URL prefix in P0)
- Charts: ECharts options built from CSS semantic tokens
- Fonts: Maven Pro + Noto Sans Khmer / KR + JetBrains Mono for metrics

## P1

- Backend `user_preferences`
- Locale in URL (`/[locale]/...`)
- Settings page parity on GUI home

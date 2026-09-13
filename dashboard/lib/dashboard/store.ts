import type { DashboardConfig, DashboardWidget } from "./types";
import { defaultDashboard } from "./presets";

const PREFIX = "pulsegrid.dashboard.terminal.";

export function dashboardStorageKey(serverId: string): string {
  return `${PREFIX}${serverId}`;
}

export function loadDashboard(serverId: string): DashboardConfig {
  if (typeof window === "undefined") {
    return defaultDashboard(serverId);
  }
  try {
    const raw = localStorage.getItem(dashboardStorageKey(serverId));
    if (!raw) return defaultDashboard(serverId);
    const parsed = JSON.parse(raw) as DashboardConfig;
    if (!parsed?.widgets || !Array.isArray(parsed.widgets)) {
      return defaultDashboard(serverId);
    }
    return {
      serverId,
      preset: parsed.preset,
      layoutMode: parsed.layoutMode ?? "normal",
      widgets: parsed.widgets,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return defaultDashboard(serverId);
  }
}

export function saveDashboard(config: DashboardConfig) {
  if (typeof window === "undefined") return;
  const next = { ...config, updatedAt: Date.now() };
  localStorage.setItem(dashboardStorageKey(config.serverId), JSON.stringify(next));
}

export function applyPositions(
  widgets: DashboardWidget[],
  positions: { id?: string | number; x?: number; y?: number; w?: number; h?: number }[],
): DashboardWidget[] {
  const byId = new Map(positions.map((p) => [String(p.id), p]));
  return widgets.map((w) => {
    const p = byId.get(w.id);
    if (!p) return w;
    return {
      ...w,
      x: p.x ?? w.x,
      y: p.y ?? w.y,
      w: p.w ?? w.w,
      h: p.h ?? w.h,
    };
  });
}

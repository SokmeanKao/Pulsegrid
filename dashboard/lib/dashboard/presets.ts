import type { DashboardConfig, DashboardWidget, WidgetType } from "./types";
import { getWidgetMeta, WIDGET_CATALOG } from "./registry";

function wid(type: WidgetType, n = 1): string {
  return `${type}-${n}`;
}

function w(
  type: WidgetType,
  x: number,
  y: number,
  width: number,
  idSuffix = 1,
): DashboardWidget {
  const meta = getWidgetMeta(type);
  return {
    id: wid(type, idSuffix),
    type,
    x,
    y,
    w: width,
    h: meta.heights.normal,
    minW: meta.minW,
    minH: meta.minH,
    config: {},
  };
}

export const PRESETS: Record<
  string,
  { label: string; widgets: DashboardWidget[] }
> = {
  general: {
    label: "General",
    widgets: [
      w("cpu", 0, 0, 5),
      w("memory", 5, 0, 3),
      w("network", 8, 0, 4),
      w("proc-health", 8, 7, 4),
      w("top-cpu", 0, 8, 3),
      w("top-mem", 3, 8, 3),
      w("disk", 6, 8, 6),
      w("processes", 0, 15, 12),
    ],
  },
  processes: {
    label: "Processes",
    widgets: [
      w("proc-health", 0, 0, 4),
      w("top-cpu", 4, 0, 4),
      w("top-mem", 8, 0, 4),
      w("processes", 0, 6, 12),
      w("cpu", 0, 16, 6),
      w("memory", 6, 16, 6),
    ],
  },
  minimal: {
    label: "Minimal",
    widgets: [
      w("cpu", 0, 0, 6),
      w("memory", 6, 0, 6),
      w("processes", 0, 8, 12),
    ],
  },
  empty: {
    label: "Empty",
    widgets: [],
  },
};

export function defaultDashboard(
  serverId: string,
  preset = "general",
): DashboardConfig {
  const p = PRESETS[preset] ?? PRESETS.general;
  return {
    serverId,
    preset,
    layoutMode: "normal",
    widgets: p.widgets.map((x) => ({ ...x, config: { ...(x.config ?? {}) } })),
    updatedAt: Date.now(),
  };
}

// Keep catalog import used for typing stability in older call sites.
void WIDGET_CATALOG;

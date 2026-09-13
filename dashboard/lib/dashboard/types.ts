export type WidgetType =
  | "cpu"
  | "memory"
  | "disk"
  | "network"
  | "processes"
  | "proc-health"
  | "top-cpu"
  | "top-mem";

/** Predictable dashboard density — no DOM height measurement. */
export type LayoutMode = "compact" | "normal" | "expanded";

export type DashboardWidget = {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  config?: Record<string, unknown>;
};

export type DashboardConfig = {
  serverId: string;
  preset?: string;
  /** Compact / Normal / Show More */
  layoutMode?: LayoutMode;
  widgets: DashboardWidget[];
  updatedAt?: number;
};

export type WidgetCatalogItem = {
  type: WidgetType;
  label: string;
  category: "SYSTEM" | "STORAGE" | "NETWORK" | "PROCESSES";
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
};

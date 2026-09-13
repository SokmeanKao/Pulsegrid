import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Box,
  Cpu,
  HardDrive,
  ListTree,
  MemoryStick,
  Network,
  Server,
  Thermometer,
} from "lucide-react";
import type { LayoutMode, WidgetCatalogItem, WidgetType } from "./types";

export type WidgetSizeProfile = Record<LayoutMode, number>;

export type WidgetRegistryEntry = {
  type: WidgetType;
  title: string;
  label: string;
  category: "SYSTEM" | "STORAGE" | "NETWORK" | "PROCESSES";
  icon: LucideIcon;
  defaultW: number;
  /** Default = normal profile height */
  defaultH: number;
  minW?: number;
  minH?: number;
  maxH?: number;
  /** Predictable GridStack heights — no DOM measurement. */
  heights: WidgetSizeProfile;
  /** Chart pixel heights per layout mode (when applicable). */
  chartHeights?: WidgetSizeProfile;
};

/** Canonical widget identity — titles, icons, and layout size profiles. */
export const WIDGET_REGISTRY: Record<WidgetType, WidgetRegistryEntry> = {
  cpu: {
    type: "cpu",
    title: "CPU",
    label: "CPU",
    category: "SYSTEM",
    icon: Cpu,
    defaultW: 5,
    defaultH: 8,
    minW: 4,
    minH: 4,
    maxH: 14,
    heights: { compact: 6, normal: 8, expanded: 12 },
    chartHeights: { compact: 72, normal: 120, expanded: 200 },
  },
  memory: {
    type: "memory",
    title: "Memory",
    label: "Memory",
    category: "SYSTEM",
    icon: MemoryStick,
    defaultW: 3,
    defaultH: 7,
    minW: 3,
    minH: 4,
    maxH: 12,
    heights: { compact: 5, normal: 7, expanded: 9 },
    chartHeights: { compact: 64, normal: 100, expanded: 160 },
  },
  disk: {
    type: "disk",
    title: "Disk",
    label: "Disk",
    category: "STORAGE",
    icon: HardDrive,
    defaultW: 6,
    defaultH: 7,
    minW: 3,
    minH: 3,
    maxH: 12,
    heights: { compact: 5, normal: 7, expanded: 9 },
    chartHeights: { compact: 64, normal: 88, expanded: 140 },
  },
  network: {
    type: "network",
    title: "Network",
    label: "Network",
    category: "NETWORK",
    icon: Network,
    defaultW: 4,
    defaultH: 7,
    minW: 3,
    minH: 3,
    maxH: 12,
    heights: { compact: 5, normal: 7, expanded: 9 },
    chartHeights: { compact: 72, normal: 110, expanded: 160 },
  },
  "proc-health": {
    type: "proc-health",
    title: "Process Health",
    label: "Process Health",
    category: "PROCESSES",
    icon: Activity,
    defaultW: 4,
    defaultH: 6,
    minW: 3,
    minH: 3,
    maxH: 10,
    heights: { compact: 4, normal: 6, expanded: 8 },
  },
  "top-cpu": {
    type: "top-cpu",
    title: "Top CPU",
    label: "Top CPU",
    category: "PROCESSES",
    icon: Cpu,
    defaultW: 3,
    defaultH: 6,
    minW: 3,
    minH: 3,
    maxH: 10,
    heights: { compact: 5, normal: 6, expanded: 8 },
    chartHeights: { compact: 120, normal: 160, expanded: 220 },
  },
  "top-mem": {
    type: "top-mem",
    title: "Top Memory",
    label: "Top Memory",
    category: "PROCESSES",
    icon: MemoryStick,
    defaultW: 3,
    defaultH: 6,
    minW: 3,
    minH: 3,
    maxH: 10,
    heights: { compact: 5, normal: 6, expanded: 8 },
    chartHeights: { compact: 120, normal: 160, expanded: 220 },
  },
  processes: {
    type: "processes",
    title: "Processes",
    label: "Process List",
    category: "PROCESSES",
    icon: ListTree,
    defaultW: 12,
    defaultH: 10,
    minW: 6,
    minH: 5,
    maxH: 18,
    // Height is viewport only — table scrolls internally.
    heights: { compact: 6, normal: 10, expanded: 16 },
  },
  docker: {
    type: "docker",
    title: "Docker",
    label: "Docker",
    category: "SYSTEM",
    icon: Box,
    defaultW: 6,
    defaultH: 8,
    minW: 4,
    minH: 4,
    maxH: 14,
    heights: { compact: 6, normal: 8, expanded: 12 },
  },
  host: {
    type: "host",
    title: "Host",
    label: "Host",
    category: "SYSTEM",
    icon: Server,
    defaultW: 3,
    defaultH: 5,
    minW: 3,
    minH: 3,
    maxH: 8,
    heights: { compact: 4, normal: 5, expanded: 6 },
  },
  sensors: {
    type: "sensors",
    title: "Sensors",
    label: "Sensors",
    category: "SYSTEM",
    icon: Thermometer,
    defaultW: 4,
    defaultH: 6,
    minW: 3,
    minH: 3,
    maxH: 10,
    heights: { compact: 5, normal: 6, expanded: 8 },
  },
};

export function getWidgetMeta(type: WidgetType): WidgetRegistryEntry {
  return WIDGET_REGISTRY[type];
}

export function widgetHeight(type: WidgetType, mode: LayoutMode): number {
  return WIDGET_REGISTRY[type].heights[mode];
}

export function widgetChartHeight(
  type: WidgetType,
  mode: LayoutMode,
  fallback = 120,
): number {
  return WIDGET_REGISTRY[type].chartHeights?.[mode] ?? fallback;
}

/** Catalog derived from the Lucide-backed widget registry. */
export const WIDGET_CATALOG: WidgetCatalogItem[] = (
  Object.values(WIDGET_REGISTRY) as WidgetRegistryEntry[]
).map((e) => ({
  type: e.type,
  label: e.label,
  category: e.category,
  defaultW: e.defaultW,
  defaultH: e.defaultH,
  minW: e.minW,
  minH: e.minH,
}));

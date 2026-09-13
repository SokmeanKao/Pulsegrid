import type { EChartsOption } from "echarts";

export type PulsegridChartTheme = {
  text: string;
  muted: string;
  border: string;
  grid: string;
  tooltip: string;
  tooltipBorder: string;
  cpu: string;
  memoryUsed: string;
  memoryCache: string;
  memoryAvail: string;
  rx: string;
  tx: string;
  diskRead: string;
  diskWrite: string;
  barCpu: string;
  barMem: string;
};

export const darkChartTheme: PulsegridChartTheme = {
  text: "#d6e2e3",
  muted: "#6e8387",
  border: "#2a3639",
  grid: "#172024",
  tooltip: "#0b1114",
  tooltipBorder: "#2a3639",
  cpu: "#3dd68c",
  memoryUsed: "#5cc8ff",
  memoryCache: "#7c6af0",
  memoryAvail: "#6e8387",
  rx: "#3dd68c",
  tx: "#5cc8ff",
  diskRead: "#3dd68c",
  diskWrite: "#f5c542",
  barCpu: "#3dd68c",
  barMem: "#5cc8ff",
};

export const lightChartTheme: PulsegridChartTheme = {
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  grid: "#e5e7eb",
  tooltip: "#ffffff",
  tooltipBorder: "#e2e8f0",
  cpu: "#059669",
  memoryUsed: "#0284c8",
  memoryCache: "#6366f1",
  memoryAvail: "#94a3b8",
  rx: "#059669",
  tx: "#0284c8",
  diskRead: "#059669",
  diskWrite: "#d97706",
  barCpu: "#059669",
  barMem: "#0284c8",
};

export function chartThemeFromCss(): PulsegridChartTheme {
  if (typeof window === "undefined") return darkChartTheme;
  const s = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => {
    const v = s.getPropertyValue(name).trim();
    return v || fallback;
  };
  const isDark = document.documentElement.classList.contains("dark");
  const base = isDark ? darkChartTheme : lightChartTheme;
  return {
    ...base,
    text: read("--pg-text", base.text),
    muted: read("--pg-muted", base.muted),
    border: read("--pg-border", base.border),
    grid: read("--pg-grid", base.grid),
    tooltip: read("--pg-tooltip", base.tooltip),
    tooltipBorder: read("--pg-border", base.tooltipBorder),
    cpu: read("--t-healthy", base.cpu),
    memoryUsed: read("--t-info", base.memoryUsed),
    rx: read("--t-healthy", base.rx),
    tx: read("--t-info", base.tx),
    diskRead: read("--t-healthy", base.diskRead),
    diskWrite: read("--t-warning", base.diskWrite),
    barCpu: read("--t-healthy", base.barCpu),
    barMem: read("--t-info", base.barMem),
  };
}

export function baseChartOption(
  theme: PulsegridChartTheme,
  partial: EChartsOption = {},
): EChartsOption {
  return {
    animation: false,
    backgroundColor: "transparent",
    textStyle: {
      color: theme.muted,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 10,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: theme.tooltip,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.text, fontSize: 11 },
    },
    ...partial,
  };
}

export function categoryAxis(theme: PulsegridChartTheme, data: string[]) {
  return {
    type: "category" as const,
    boundaryGap: false,
    data,
    axisLabel: {
      color: theme.muted,
      fontSize: 9,
      hideOverlap: true,
    },
    axisLine: { lineStyle: { color: theme.border } },
    axisTick: { show: false },
  };
}

export function valueAxis(
  theme: PulsegridChartTheme,
  opts?: {
    min?: number;
    max?: number;
    formatter?: string | ((v: number) => string);
  },
) {
  return {
    type: "value" as const,
    min: opts?.min,
    max: opts?.max,
    splitNumber: 4,
    axisLabel: {
      color: theme.muted,
      fontSize: 9,
      formatter: opts?.formatter,
    },
    splitLine: { lineStyle: { color: theme.grid } },
    axisLine: { show: false },
    axisTick: { show: false },
  };
}

export function historyTimes(history: { collectedAtUnixMs: number }[]): string[] {
  return history.map((p) =>
    new Date(p.collectedAtUnixMs).toLocaleTimeString(undefined, {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  );
}

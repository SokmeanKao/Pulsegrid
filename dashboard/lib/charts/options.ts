import type { EChartsOption } from "echarts";
import type { MetricsEnvelope, ProcessMetrics } from "@/lib/types";
import {
  baseChartOption,
  categoryAxis,
  historyTimes,
  valueAxis,
  type PulsegridChartTheme,
} from "./theme";

export function cpuHistoryOption(
  history: MetricsEnvelope[],
  theme: PulsegridChartTheme,
): EChartsOption {
  const times = historyTimes(history);
  const values = history.map((p) =>
    Number((p.cpu?.usagePercent ?? 0).toFixed(1)),
  );
  return baseChartOption(theme, {
    grid: { left: 36, right: 10, top: 10, bottom: 22 },
    xAxis: categoryAxis(theme, times),
    yAxis: valueAxis(theme, { min: 0, max: 100, formatter: "{value}%" }),
    series: [
      {
        name: "CPU",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: values,
        lineStyle: { color: theme.cpu, width: 1.5 },
        areaStyle: { color: hexAlpha(theme.cpu, 0.12) },
      },
    ],
  });
}

export function memoryStackOption(
  history: MetricsEnvelope[],
  theme: PulsegridChartTheme,
): EChartsOption {
  const times = historyTimes(history);
  const used = history.map((p) => {
    const m = p.memory;
    if (!m) return 0;
    return Number((m.usedMb / 1024).toFixed(2));
  });
  const cache = history.map((p) => {
    const m = p.memory;
    if (!m) return 0;
    return Number((m.cachedMb / 1024).toFixed(2));
  });
  const available = history.map((p) => {
    const m = p.memory;
    if (!m) return 0;
    return Number((m.availableMb / 1024).toFixed(2));
  });

  return baseChartOption(theme, {
    grid: { left: 40, right: 10, top: 24, bottom: 22 },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 6,
      textStyle: { color: theme.muted, fontSize: 9 },
      data: ["Used", "Cache", "Available"],
    },
    xAxis: categoryAxis(theme, times),
    yAxis: valueAxis(theme, {
      min: 0,
      formatter: (v: number) => `${v}G`,
    }),
    series: [
      {
        name: "Used",
        type: "line",
        stack: "memory",
        smooth: true,
        showSymbol: false,
        data: used,
        lineStyle: { width: 1, color: theme.memoryUsed },
        areaStyle: { color: hexAlpha(theme.memoryUsed, 0.35) },
      },
      {
        name: "Cache",
        type: "line",
        stack: "memory",
        smooth: true,
        showSymbol: false,
        data: cache,
        lineStyle: { width: 1, color: theme.memoryCache },
        areaStyle: { color: hexAlpha(theme.memoryCache, 0.25) },
      },
      {
        name: "Available",
        type: "line",
        stack: "memory",
        smooth: true,
        showSymbol: false,
        data: available,
        lineStyle: { width: 1, color: theme.memoryAvail },
        areaStyle: { color: hexAlpha(theme.memoryAvail, 0.18) },
      },
    ],
  });
}

export function networkHistoryOption(
  history: MetricsEnvelope[],
  theme: PulsegridChartTheme,
): EChartsOption {
  const times = historyTimes(history);
  const toMbps = (bytesPerSec: number) =>
    Number(((bytesPerSec * 8) / 1_000_000).toFixed(3));

  const rx = history.map((p) => {
    const sum = (p.networks ?? []).reduce(
      (s, n) => s + (n.rxBytesPerSec || 0),
      0,
    );
    return toMbps(sum);
  });
  const tx = history.map((p) => {
    const sum = (p.networks ?? []).reduce(
      (s, n) => s + (n.txBytesPerSec || 0),
      0,
    );
    return toMbps(sum);
  });

  return baseChartOption(theme, {
    grid: { left: 44, right: 10, top: 24, bottom: 22 },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 6,
      textStyle: { color: theme.muted, fontSize: 9 },
      data: ["RX", "TX"],
    },
    xAxis: categoryAxis(theme, times),
    yAxis: valueAxis(theme, {
      min: 0,
      formatter: (v: number) => `${v}`,
    }),
    series: [
      {
        name: "RX",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: rx,
        lineStyle: { color: theme.rx, width: 1.5 },
        areaStyle: { color: hexAlpha(theme.rx, 0.1) },
      },
      {
        name: "TX",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: tx,
        lineStyle: { color: theme.tx, width: 1.5 },
        areaStyle: { color: hexAlpha(theme.tx, 0.1) },
      },
    ],
  });
}

export function diskIoHistoryOption(
  history: MetricsEnvelope[],
  theme: PulsegridChartTheme,
): EChartsOption {
  const times = historyTimes(history);
  const toMBps = (n: number) => Number((n / (1024 * 1024)).toFixed(2));
  const read = history.map((p) =>
    toMBps((p.disks ?? []).reduce((s, d) => s + (d.readBytesPerSec || 0), 0)),
  );
  const write = history.map((p) =>
    toMBps((p.disks ?? []).reduce((s, d) => s + (d.writeBytesPerSec || 0), 0)),
  );

  return baseChartOption(theme, {
    grid: { left: 40, right: 10, top: 24, bottom: 22 },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 6,
      textStyle: { color: theme.muted, fontSize: 9 },
      data: ["Read", "Write"],
    },
    xAxis: categoryAxis(theme, times),
    yAxis: valueAxis(theme, {
      min: 0,
      formatter: (v: number) => `${v}`,
    }),
    series: [
      {
        name: "Read",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: read,
        lineStyle: { color: theme.diskRead, width: 1.5 },
      },
      {
        name: "Write",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: write,
        lineStyle: { color: theme.diskWrite, width: 1.5 },
      },
    ],
  });
}

export function topProcessBarOption(
  rows: ProcessMetrics[],
  mode: "cpu" | "mem",
  theme: PulsegridChartTheme,
): EChartsOption {
  const names = rows.map((p) => (p.name || "?").slice(0, 16));
  const values =
    mode === "cpu"
      ? rows.map((p) => Number((p.cpuPercent ?? 0).toFixed(1)))
      : rows.map((p) => Number((p.memoryMb ?? 0).toFixed(0)));

  const color = mode === "cpu" ? theme.barCpu : theme.barMem;
  const max =
    mode === "cpu"
      ? Math.max(100, ...values, 1)
      : Math.max(...values, 1) * 1.15;

  return baseChartOption(theme, {
    grid: { left: 88, right: 48, top: 8, bottom: 8 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "value",
      max,
      axisLabel: {
        color: theme.muted,
        fontSize: 9,
        formatter: mode === "cpu" ? "{value}%" : "{value}M",
      },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: names,
      axisLabel: { color: theme.text, fontSize: 10 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar",
        data: values,
        barWidth: 8,
        itemStyle: { color, borderRadius: [0, 2, 2, 0] },
        label: {
          show: true,
          position: "right",
          color: theme.muted,
          fontSize: 9,
          formatter: mode === "cpu" ? "{c}%" : "{c}M",
        },
      },
    ],
  });
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

"use client";

import type { MetricsEnvelope, ProcessMetrics } from "@/lib/types";
import { topProcessBarOption } from "@/lib/charts/options";
import { useThemedOption } from "@/lib/charts/useChartTheme";
import { widgetChartHeight } from "@/lib/dashboard/registry";
import { MetricChart } from "@/components/charts/MetricChart";
import { TerminalWidget } from "./TerminalWidget";
import { useTerminalEditMode } from "./edit-mode";
import { useLayoutMode } from "./layout-mode";

type Props = {
  sample: MetricsEnvelope | null;
};

export function TopCpuPanel({ sample }: Props) {
  const editMode = useTerminalEditMode();
  const layoutMode = useLayoutMode();
  const option = useThemedOption((theme) => {
    const rows = pickTop(sample?.topProcesses ?? [], "cpu", 6);
    return topProcessBarOption(rows, "cpu", theme);
  }, [sample]);

  return (
    <TerminalWidget
      type="top-cpu"
      sample={sample}
      editMode={editMode}
      emptyMessage="No processes"
    >
      <MetricChart
        option={option}
        height={widgetChartHeight("top-cpu", layoutMode)}
      />
    </TerminalWidget>
  );
}

export function TopMemoryPanel({ sample }: Props) {
  const editMode = useTerminalEditMode();
  const layoutMode = useLayoutMode();
  const option = useThemedOption((theme) => {
    const rows = pickTop(sample?.topProcesses ?? [], "mem", 6);
    return topProcessBarOption(rows, "mem", theme);
  }, [sample]);

  return (
    <TerminalWidget
      type="top-mem"
      sample={sample}
      editMode={editMode}
      emptyMessage="No processes"
    >
      <MetricChart
        option={option}
        height={widgetChartHeight("top-mem", layoutMode)}
      />
    </TerminalWidget>
  );
}

function pickTop(
  list: ProcessMetrics[],
  mode: "cpu" | "mem",
  n: number,
): ProcessMetrics[] {
  const sorted = [...list].sort((a, b) =>
    mode === "cpu"
      ? (b.cpuPercent ?? 0) - (a.cpuPercent ?? 0)
      : (b.memoryMb ?? 0) - (a.memoryMb ?? 0),
  );
  const seen = new Set<number>();
  const out: ProcessMetrics[] = [];
  for (const p of sorted) {
    if (seen.has(p.pid)) continue;
    seen.add(p.pid);
    out.push(p);
    if (out.length >= n) break;
  }
  return out;
}

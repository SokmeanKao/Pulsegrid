"use client";

import type { MetricsEnvelope } from "@/lib/types";
import { cpuHistoryOption } from "@/lib/charts/options";
import { useThemedOption } from "@/lib/charts/useChartTheme";
import { widgetChartHeight } from "@/lib/dashboard/registry";
import { MetricChart } from "@/components/charts/MetricChart";
import { AsciiProgress } from "./AsciiProgress";
import { TerminalWidget } from "./TerminalWidget";
import { useTerminalEditMode } from "./edit-mode";
import { useLayoutMode } from "./layout-mode";

type Props = {
  sample: MetricsEnvelope | null;
  history: MetricsEnvelope[];
};

export function CpuPanel({ sample, history }: Props) {
  const editMode = useTerminalEditMode();
  const layoutMode = useLayoutMode();
  const cpu = sample?.cpu;
  const cores = cpu?.perCorePercent ?? [];
  const option = useThemedOption(
    (theme) => cpuHistoryOption(history, theme),
    [history],
  );
  const chartH = widgetChartHeight("cpu", layoutMode);

  return (
    <TerminalWidget
      type="cpu"
      sample={sample}
      titleSuffix={`${cpu?.logicalCores ?? "—"} cores`}
      editMode={editMode}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <AsciiProgress label="TOTAL" pct={cpu?.usagePercent ?? 0} />
          <span className="metric-value shrink-0 text-lg text-[var(--t-healthy)]">
            {(cpu?.usagePercent ?? 0).toFixed(1)}%
          </span>
        </div>
        <div className="max-h-20 space-y-0.5 overflow-auto">
          {cores.length === 0 ? (
            <p className="text-[var(--t-muted)]">No per-core samples yet</p>
          ) : (
            cores.slice(0, layoutMode === "compact" ? 4 : 8).map((pct, i) => (
              <AsciiProgress key={i} label={`CPU${i}`} pct={pct} width={14} />
            ))
          )}
        </div>
        <p className="text-[10px] text-[var(--t-muted)]">
          LOAD 1m {(cpu?.load1 ?? 0).toFixed(2)} · 5m{" "}
          {(cpu?.load5 ?? 0).toFixed(2)} · 15m {(cpu?.load15 ?? 0).toFixed(2)}
        </p>
        <MetricChart option={option} height={chartH} />
      </div>
    </TerminalWidget>
  );
}

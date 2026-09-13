"use client";

import type { MetricsEnvelope } from "@/lib/types";
import { formatMb } from "@/lib/terminal/format";
import { memoryStackOption } from "@/lib/charts/options";
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

export function MemoryPanel({ sample, history }: Props) {
  const editMode = useTerminalEditMode();
  const layoutMode = useLayoutMode();
  const m = sample?.memory;
  const usedPct =
    m && m.totalMb > 0 ? ((m.totalMb - m.availableMb) / m.totalMb) * 100 : 0;
  const swapPct =
    m && m.swapTotalMb > 0 ? (m.swapUsedMb / m.swapTotalMb) * 100 : 0;
  const pressure =
    usedPct >= 95
      ? "CRITICAL"
      : usedPct >= 85
        ? "HIGH"
        : usedPct >= 70
          ? "ELEVATED"
          : "OK";
  const option = useThemedOption(
    (theme) => memoryStackOption(history, theme),
    [history],
  );
  const chartH = widgetChartHeight("memory", layoutMode);

  return (
    <TerminalWidget type="memory" sample={sample} editMode={editMode}>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-[var(--t-muted)]">
            {m
              ? `${formatMb(m.totalMb - m.availableMb)} / ${formatMb(m.totalMb)}`
              : "—"}
          </span>
          <span className="metric-value text-lg text-[var(--t-info)]">
            {usedPct.toFixed(0)}%
          </span>
        </div>
        <AsciiProgress label="RAM" pct={usedPct} />
        <AsciiProgress
          label="SWAP"
          pct={swapPct}
          detail={
            m
              ? `${formatMb(m.swapUsedMb)} / ${formatMb(m.swapTotalMb)}`
              : undefined
          }
        />
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-[var(--t-muted)]">
          <div>Used</div>
          <div className="metric-value text-right text-[var(--t-text)]">
            {m ? formatMb(m.usedMb) : "—"}
          </div>
          <div>Cached</div>
          <div className="metric-value text-right text-[var(--t-text)]">
            {m ? formatMb(m.cachedMb) : "—"}
          </div>
          <div>Available</div>
          <div className="metric-value text-right text-[var(--t-text)]">
            {m ? formatMb(m.availableMb) : "—"}
          </div>
          <div>Pressure</div>
          <div
            className={`text-right ${
              pressure === "CRITICAL" || pressure === "HIGH"
                ? "text-[var(--t-critical)]"
                : "text-[var(--t-healthy)]"
            }`}
          >
            {pressure}
          </div>
        </div>
        <MetricChart option={option} height={chartH} />
      </div>
    </TerminalWidget>
  );
}

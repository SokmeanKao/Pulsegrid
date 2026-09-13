"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import type { MetricsEnvelope } from "@/lib/types";
import { formatBitsPerSec, formatBytes } from "@/lib/terminal/format";
import { iconSm, iconStroke } from "@/lib/dashboard/icons";
import {
  diskIoHistoryOption,
  networkHistoryOption,
} from "@/lib/charts/options";
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

export function DiskPanel({ sample, history }: Props) {
  const editMode = useTerminalEditMode();
  const layoutMode = useLayoutMode();
  const disks = sample?.disks ?? [];
  const read = disks.reduce((s, d) => s + (d.readBytesPerSec || 0), 0);
  const write = disks.reduce((s, d) => s + (d.writeBytesPerSec || 0), 0);
  const iops = disks.reduce(
    (s, d) => s + (d.readOpsPerSec || 0) + (d.writeOpsPerSec || 0),
    0,
  );
  const option = useThemedOption(
    (theme) => diskIoHistoryOption(history, theme),
    [history],
  );
  const chartH = widgetChartHeight("disk", layoutMode);

  return (
    <TerminalWidget
      type="disk"
      sample={sample}
      editMode={editMode}
      emptyMessage="No disk mounts"
    >
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <div className="text-[var(--t-muted)]">READ</div>
            <div className="metric-value text-[var(--t-healthy)]">
              {formatBytes(read)}/s
            </div>
          </div>
          <div>
            <div className="text-[var(--t-muted)]">WRITE</div>
            <div className="metric-value text-[var(--t-warning)]">
              {formatBytes(write)}/s
            </div>
          </div>
          <div>
            <div className="text-[var(--t-muted)]">IOPS</div>
            <div className="metric-value text-[var(--t-text)]">
              {iops.toFixed(0)}
            </div>
          </div>
        </div>
        <div className="max-h-24 space-y-1 overflow-auto">
          {disks.slice(0, 4).map((d) => {
            const pct = d.totalGb > 0 ? (d.usedGb / d.totalGb) * 100 : 0;
            return (
              <AsciiProgress
                key={d.mount}
                label={d.mount.slice(0, 8)}
                pct={pct}
                width={12}
                detail={`${d.usedGb.toFixed(0)}G/${d.totalGb.toFixed(0)}G`}
              />
            );
          })}
        </div>
        <MetricChart option={option} height={chartH} />
        <p className="text-[10px] text-[var(--t-muted)]">I/O MB/s over time</p>
      </div>
    </TerminalWidget>
  );
}

export function NetworkPanel({ sample, history }: Props) {
  const editMode = useTerminalEditMode();
  const layoutMode = useLayoutMode();
  const nets = sample?.networks ?? [];
  const primary =
    [...nets].sort(
      (a, b) =>
        b.rxBytesPerSec +
        b.txBytesPerSec -
        (a.rxBytesPerSec + a.txBytesPerSec),
    )[0] ?? nets[0];
  const rx = nets.reduce((s, n) => s + (n.rxBytesPerSec || 0), 0);
  const tx = nets.reduce((s, n) => s + (n.txBytesPerSec || 0), 0);
  const option = useThemedOption(
    (theme) => networkHistoryOption(history, theme),
    [history],
  );
  const chartH = widgetChartHeight("network", layoutMode);

  return (
    <TerminalWidget
      type="network"
      sample={sample}
      titleSuffix={primary?.interfaceName}
      editMode={editMode}
      emptyMessage="No network interfaces"
    >
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1 text-[10px] text-[var(--t-muted)]">
              <ArrowDown className={iconSm} strokeWidth={iconStroke} aria-hidden />
              RX
            </div>
            <div className="text-sm text-[var(--t-healthy)]">
              {formatBitsPerSec(rx)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-[10px] text-[var(--t-muted)]">
              <ArrowUp className={iconSm} strokeWidth={iconStroke} aria-hidden />
              TX
            </div>
            <div className="text-sm text-[var(--t-info)]">
              {formatBitsPerSec(tx)}
            </div>
          </div>
        </div>
        <MetricChart option={option} height={chartH} />
        {primary ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-[var(--t-muted)]">
            <div>Received</div>
            <div className="metric-value text-right text-[var(--t-text)]">
              {formatBytes(primary.rxBytesTotal)}
            </div>
            <div>Sent</div>
            <div className="metric-value text-right text-[var(--t-text)]">
              {formatBytes(primary.txBytesTotal)}
            </div>
          </div>
        ) : null}
      </div>
    </TerminalWidget>
  );
}

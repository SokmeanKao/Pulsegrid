"use client";

import type { MetricsEnvelope } from "@/lib/types";
import type { DashboardWidget } from "@/lib/dashboard/types";
import { CpuPanel } from "./CpuPanel";
import { MemoryPanel } from "./MemoryPanel";
import { DiskPanel, NetworkPanel } from "./DiskNetworkPanels";
import { ProcessPanel } from "./ProcessPanel";
import { ProcessHealthPanel } from "./ProcessHealthPanel";
import { TopCpuPanel, TopMemoryPanel } from "./TopProcessPanels";

type Props = {
  widget: DashboardWidget;
  sample: MetricsEnvelope | null;
  history: MetricsEnvelope[];
  editMode?: boolean;
  onRemove?: (id: string) => void;
};

export function DashboardWidgetView({
  widget,
  sample,
  history,
  editMode,
  onRemove,
}: Props) {
  const body = (() => {
    switch (widget.type) {
      case "cpu":
        return <CpuPanel sample={sample} history={history} />;
      case "memory":
        return <MemoryPanel sample={sample} history={history} />;
      case "disk":
        return <DiskPanel sample={sample} history={history} />;
      case "network":
        return <NetworkPanel sample={sample} history={history} />;
      case "proc-health":
        return <ProcessHealthPanel sample={sample} />;
      case "top-cpu":
        return <TopCpuPanel sample={sample} />;
      case "top-mem":
        return <TopMemoryPanel sample={sample} />;
      case "processes":
        return <ProcessPanel sample={sample} />;
      default:
        return (
          <div className="p-2 font-mono text-xs text-[var(--t-muted)]">
            Unknown widget: {widget.type}
          </div>
        );
    }
  })();

  return (
    <div className="relative h-full">
      {editMode && onRemove ? (
        <button
          type="button"
          title="Remove widget"
          className="absolute right-1 top-1 z-10 border border-[var(--t-border)] bg-[var(--t-panel)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--t-muted)] hover:border-[var(--t-critical)] hover:text-[var(--t-critical)]"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(widget.id);
          }}
        >
          ✕
        </button>
      ) : null}
      {body}
    </div>
  );
}

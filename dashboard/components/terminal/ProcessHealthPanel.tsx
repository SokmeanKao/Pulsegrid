"use client";

import type { MetricsEnvelope } from "@/lib/types";
import { TerminalWidget } from "./TerminalWidget";
import { useTerminalEditMode } from "./edit-mode";

type Props = {
  sample: MetricsEnvelope | null;
};

export function ProcessHealthPanel({ sample }: Props) {
  const editMode = useTerminalEditMode();
  const s = sample?.processSummary;
  const top = [...(sample?.topProcesses ?? [])]
    .sort((a, b) => (b.cpuPercent ?? 0) - (a.cpuPercent ?? 0))
    .slice(0, 4);

  const bar = (pct: number) => {
    const n = Math.max(0, Math.min(16, Math.round((pct / 100) * 16)));
    return "█".repeat(n).padEnd(16, "░");
  };

  return (
    <TerminalWidget
      type="proc-health"
      sample={sample}
      editMode={editMode}
      emptyMessage="No process summary"
    >
      <>
        <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
          <Stat label="TOTAL" value={s?.total ?? top.length} />
          <Stat label="RUNNING" value={s?.running ?? 0} tone="healthy" />
          <Stat label="SLEEPING" value={s?.sleeping ?? 0} />
          <Stat
            label="ZOMBIE"
            value={s?.zombie ?? 0}
            tone={(s?.zombie ?? 0) > 0 ? "critical" : undefined}
          />
          <Stat label="THREADS" value={s?.threads ?? 0} />
        </div>
        <div className="mt-3 text-[10px] uppercase tracking-wider text-[var(--t-muted)]">
          CPU by process
        </div>
        <div className="mt-1 space-y-0.5 font-mono text-[11px]">
          {top.length === 0 ? (
            <p className="text-[var(--t-muted)]">—</p>
          ) : (
            top.map((p) => (
              <div key={p.pid} className="flex items-center gap-2">
                <span className="w-20 truncate text-[var(--t-text)]">
                  {(p.name || "?").slice(0, 12)}
                </span>
                <span className="text-[var(--t-healthy)]">
                  {bar(p.cpuPercent ?? 0)}
                </span>
                <span className="tabular-nums text-[var(--t-muted)]">
                  {(p.cpuPercent ?? 0).toFixed(0)}%
                </span>
              </div>
            ))
          )}
        </div>
      </>
    </TerminalWidget>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "healthy" | "critical";
}) {
  const color =
    tone === "critical"
      ? "text-[var(--t-critical)]"
      : tone === "healthy"
        ? "text-[var(--t-healthy)]"
        : "text-[var(--t-text)]";
  return (
    <div>
      <div className="text-[var(--t-muted)]">{label}</div>
      <div className={`text-sm tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

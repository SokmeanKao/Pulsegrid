"use client";

import { asciiBar, clampPct } from "@/lib/terminal/format";

export function AsciiProgress({
  label,
  pct,
  detail,
  width = 22,
}: {
  label: string;
  pct: number;
  detail?: string;
  width?: number;
}) {
  const v = clampPct(pct);
  return (
    <div className="flex items-baseline gap-2 whitespace-pre">
      <span className="w-10 shrink-0 text-[var(--t-muted)]">{label}</span>
      <span className="tabular-nums text-[var(--t-text)]">{v.toFixed(0).padStart(3)}%</span>
      <span className="text-[var(--t-healthy)]">{asciiBar(v, width)}</span>
      {detail ? <span className="text-[var(--t-muted)]">{detail}</span> : null}
    </div>
  );
}

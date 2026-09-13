"use client";

import { Server } from "lucide-react";
import { STATUS_ICONS, iconSm, iconStroke } from "@/lib/dashboard/icons";
import { toneColor, type HealthTone } from "@/lib/terminal/theme";
import { cn } from "@/lib/utils";

export type HostRow = {
  id: string;
  tone: HealthTone;
  cpu: number;
};

type Props = {
  hosts: HostRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyHint?: string;
};

export function HostList({ hosts, selectedId, onSelect, emptyHint }: Props) {
  return (
    <div className="space-y-0.5">
      {hosts.length === 0 ? (
        <p className="text-[var(--t-muted)]">
          {emptyHint ?? "Waiting for hosts…"}
        </p>
      ) : (
        hosts.map((h) => {
          const selected = h.id === selectedId;
          const StatusIcon = STATUS_ICONS[h.tone];
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelect(h.id)}
              className={cn(
                "flex w-full items-center gap-2 px-1 py-0.5 text-left font-mono text-xs",
                selected
                  ? "bg-[var(--t-info)]/20 text-[var(--t-text)]"
                  : "text-[var(--t-muted)] hover:bg-white/5 hover:text-[var(--t-text)]",
              )}
            >
              <StatusIcon
                className={iconSm}
                strokeWidth={iconStroke}
                style={{ color: toneColor(h.tone) }}
                aria-hidden
              />
              <Server
                className={cn(iconSm, selected ? "text-[var(--t-info)]" : "text-[var(--t-muted)]")}
                strokeWidth={iconStroke}
                aria-hidden
              />
              <span className={cn("flex-1 truncate", selected && "text-[var(--t-text)]")}>
                {selected ? `> ${h.id}` : `  ${h.id}`}
              </span>
              <span className="tabular-nums">{h.cpu.toFixed(0)}%</span>
            </button>
          );
        })
      )}
    </div>
  );
}

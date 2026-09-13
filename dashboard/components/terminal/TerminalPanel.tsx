"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GridDragHandle } from "@/components/grid/GridStackBoard";

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
  right?: ReactNode;
  draggable?: boolean;
};

export function TerminalPanel({
  title,
  children,
  className,
  right,
  draggable = false,
}: Props) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col border border-[var(--t-border)] bg-[var(--t-panel)]",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-[var(--t-border)] px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-[var(--t-info)]">
        <span className="flex items-center gap-1">
          {draggable ? (
            <GridDragHandle className="text-[var(--t-muted)]" />
          ) : null}
          ┌─ {title} ─
        </span>
        {right}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-2 font-mono text-xs text-[var(--t-text)]">
        {children}
      </div>
    </section>
  );
}

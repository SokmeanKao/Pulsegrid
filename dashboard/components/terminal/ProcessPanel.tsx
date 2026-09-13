"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import type { MetricsEnvelope, ProcessMetrics } from "@/lib/types";
import { formatBytes, formatMb } from "@/lib/terminal/format";
import {
  iconSm,
  iconStroke,
  processStateIcon,
} from "@/lib/dashboard/icons";
import { TerminalWidget } from "./TerminalWidget";
import { useTerminalEditMode } from "./edit-mode";
import { cn } from "@/lib/utils";

type Props = {
  sample: MetricsEnvelope | null;
};

type SortKey = "cpu" | "mem" | "io" | "pid" | "name";
type ViewMode = "table" | "tree";
type StateFilter = "all" | "RUNNING" | "SLEEPING" | "ZOMBIE";

export function ProcessPanel({ sample }: Props) {
  const editMode = useTerminalEditMode();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("cpu");
  const [view, setView] = useState<ViewMode>("table");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [selected, setSelected] = useState<ProcessMetrics | null>(null);

  const total = sample?.processSummary?.total ?? sample?.topProcesses?.length ?? 0;
  const rows = useMemo(() => {
    let list = [...(sample?.topProcesses ?? [])];
    if (stateFilter !== "all") {
      list = list.filter((p) => (p.state || "").toUpperCase() === stateFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          String(p.pid).includes(q) ||
          (p.command || "").toLowerCase().includes(q) ||
          (p.user || "").toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      switch (sort) {
        case "mem":
          return (b.memoryMb ?? 0) - (a.memoryMb ?? 0);
        case "io":
          return (
            (b.readBytesPerSec ?? 0) +
            (b.writeBytesPerSec ?? 0) -
            ((a.readBytesPerSec ?? 0) + (a.writeBytesPerSec ?? 0))
          );
        case "pid":
          return a.pid - b.pid;
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        default:
          return (b.cpuPercent ?? 0) - (a.cpuPercent ?? 0);
      }
    });
    return list;
  }, [sample, query, sort, stateFilter]);

  return (
    <TerminalWidget
      type="processes"
      sample={sample}
      titleSuffix={String(total)}
      editMode={editMode}
      emptyMessage="No processes in sample"
      right={
        <span className="flex gap-1 normal-case tracking-normal">
          <Toggle active={view === "table"} onClick={() => setView("table")}>
            Table
          </Toggle>
          <Toggle active={view === "tree"} onClick={() => setView("tree")}>
            Tree
          </Toggle>
        </span>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="relative min-w-[140px] flex-1">
            <Search
              className={cn(
                iconSm,
                "pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--t-muted)]",
              )}
              strokeWidth={iconStroke}
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full border border-[var(--t-border)] bg-[var(--t-bg)] py-0.5 pl-7 pr-2 text-[11px] outline-none"
            />
          </div>
          {(["all", "RUNNING", "SLEEPING", "ZOMBIE"] as const).map((s) => (
            <Toggle
              key={s}
              active={stateFilter === s}
              onClick={() => setStateFilter(s)}
              warn={s === "ZOMBIE" && (sample?.processSummary?.zombie ?? 0) > 0}
            >
              {s === "all" ? "All" : s.slice(0, 1) + s.slice(1).toLowerCase()}
            </Toggle>
          ))}
          <label className="text-[10px] text-[var(--t-muted)]">
            Sort{" "}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="border border-[var(--t-border)] bg-[var(--t-bg)] px-1 py-0.5 text-[11px]"
            >
              <option value="cpu">CPU ▼</option>
              <option value="mem">MEM ▼</option>
              <option value="io">I/O ▼</option>
              <option value="pid">PID</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>

        <div className="flex min-h-0 flex-1 gap-2">
          <div className="min-w-0 flex-1 overflow-y-auto">
            {view === "table" ? (
              <ProcessTable rows={rows} selected={selected} onSelect={setSelected} />
            ) : (
              <ProcessTree rows={rows} selected={selected} onSelect={setSelected} />
            )}
          </div>
          {selected ? (
            <ProcessDetail process={selected} onClose={() => setSelected(null)} />
          ) : null}
        </div>

        <div className="shrink-0 text-[10px] text-[var(--t-muted)]">
          Showing {rows.length}
          {total > 0 ? ` of ${total}` : ""}
        </div>
      </div>
    </TerminalWidget>
  );
}

function ProcessTable({
  rows,
  selected,
  onSelect,
}: {
  rows: ProcessMetrics[];
  selected: ProcessMetrics | null;
  onSelect: (p: ProcessMetrics) => void;
}) {
  return (
    <table className="w-full border-collapse text-left text-[11px] leading-5">
      <thead className="sticky top-0 bg-[var(--t-panel)] text-[10px] text-[var(--t-muted)]">
        <tr>
          <th className="pr-2 font-normal">PID</th>
          <th className="pr-2 font-normal">PROCESS</th>
          <th className="pr-2 font-normal">CPU</th>
          <th className="pr-2 font-normal">MEM</th>
          <th className="pr-2 font-normal">READ/s</th>
          <th className="pr-2 font-normal">WRITE/s</th>
          <th className="pr-2 font-normal">THR</th>
          <th className="font-normal">STATE</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={8} className="text-[var(--t-muted)]">
              —
            </td>
          </tr>
        ) : (
          rows.map((p) => (
            <tr
              key={p.pid}
              onClick={() => onSelect(p)}
              className={cn(
                "cursor-pointer hover:bg-white/5",
                selected?.pid === p.pid && "bg-[var(--t-info)]/15",
              )}
            >
              <td className="pr-2 tabular-nums text-[var(--t-muted)]">{p.pid}</td>
              <td className="max-w-[140px] truncate pr-2" title={p.command || p.name}>
                {p.name}
              </td>
              <td className="pr-2 tabular-nums">{(p.cpuPercent ?? 0).toFixed(1)}%</td>
              <td className="pr-2 tabular-nums">{formatMb(p.memoryMb ?? 0)}</td>
              <td className="pr-2 tabular-nums text-[var(--t-muted)]">
                {formatBytes(p.readBytesPerSec ?? 0)}/s
              </td>
              <td className="pr-2 tabular-nums text-[var(--t-muted)]">
                {formatBytes(p.writeBytesPerSec ?? 0)}/s
              </td>
              <td className="pr-2 tabular-nums text-[var(--t-muted)]">
                {p.threadCount ?? "—"}
              </td>
              <td className="tabular-nums">
                <ProcessStateCell state={p.state} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function ProcessStateCell({ state }: { state?: string }) {
  const { Icon, className, label } = processStateIcon(state);
  return (
    <span className={cn("inline-flex items-center gap-1", className)} title={label}>
      <Icon className={iconSm} strokeWidth={iconStroke} aria-hidden />
      <span className="max-w-[4.5rem] truncate">{label.slice(0, 8)}</span>
    </span>
  );
}

function ProcessTree({
  rows,
  selected,
  onSelect,
}: {
  rows: ProcessMetrics[];
  selected: ProcessMetrics | null;
  onSelect: (p: ProcessMetrics) => void;
}) {
  const byPid = new Map(rows.map((p) => [p.pid, p]));
  const children = new Map<number, ProcessMetrics[]>();
  const roots: ProcessMetrics[] = [];

  for (const p of rows) {
    const ppid = p.ppid ?? 0;
    if (ppid && byPid.has(ppid) && ppid !== p.pid) {
      const list = children.get(ppid) ?? [];
      list.push(p);
      children.set(ppid, list);
    } else {
      roots.push(p);
    }
  }

  const render = (p: ProcessMetrics, depth: number): ReactNode => {
    const kids = children.get(p.pid) ?? [];
    return (
      <div key={p.pid}>
        <button
          type="button"
          onClick={() => onSelect(p)}
          className={cn(
            "flex w-full items-baseline gap-2 px-1 text-left text-[11px] hover:bg-white/5",
            selected?.pid === p.pid && "bg-[var(--t-info)]/15",
          )}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          <span className="text-[var(--t-muted)]">{depth === 0 ? "├─" : "└─"}</span>
          <span className="truncate">{p.name}</span>
          <span className="text-[var(--t-muted)]">[{p.pid}]</span>
          <span className="ml-auto tabular-nums text-[var(--t-muted)]">
            {(p.cpuPercent ?? 0).toFixed(0)}% · {formatMb(p.memoryMb ?? 0)}
          </span>
        </button>
        {kids.map((c) => render(c, depth + 1))}
      </div>
    );
  };

  if (rows.length === 0) {
    return <p className="text-[var(--t-muted)]">—</p>;
  }

  return (
    <div className="font-mono">
      <p className="mb-1 text-[10px] text-[var(--t-muted)]">
        Tree from streamed top processes (PPID links when parent is in sample)
      </p>
      {roots.map((r) => render(r, 0))}
    </div>
  );
}

function ProcessDetail({
  process: p,
  onClose,
}: {
  process: ProcessMetrics;
  onClose: () => void;
}) {
  const uptime =
    p.startTimeUnixMs && p.startTimeUnixMs > 0
      ? formatUptime(Date.now() - p.startTimeUnixMs)
      : "—";

  return (
    <aside className="w-[220px] shrink-0 overflow-auto border border-[var(--t-border)] bg-[var(--t-bg)] p-2 text-[11px]">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="truncate text-[var(--t-info)]">{p.name}</div>
          <div className="text-[10px] text-[var(--t-muted)]">
            PID {p.pid} · {(p.state || "UNKNOWN").toUpperCase()}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--t-muted)] hover:text-[var(--t-text)]"
        >
          ✕
        </button>
      </div>
      <Dl
        rows={[
          ["CPU", `${(p.cpuPercent ?? 0).toFixed(1)}%`],
          ["Memory", formatMb(p.memoryMb ?? 0)],
          ["Threads", String(p.threadCount ?? "—")],
          ["User", p.user || "—"],
          ["Uptime", uptime],
          ["PPID", String(p.ppid ?? "—")],
          ["Read/s", `${formatBytes(p.readBytesPerSec ?? 0)}/s`],
          ["Write/s", `${formatBytes(p.writeBytesPerSec ?? 0)}/s`],
          ["RSS", p.rssBytes != null ? formatBytes(p.rssBytes) : "—"],
          ["VMS", p.vmsBytes != null ? formatBytes(p.vmsBytes) : "—"],
        ]}
      />
      <div className="mt-2 text-[10px] uppercase text-[var(--t-muted)]">Command</div>
      <pre className="mt-0.5 whitespace-pre-wrap break-all text-[10px] text-[var(--t-text)]">
        {p.command || p.name || "—"}
      </pre>
    </aside>
  );
}

function Dl({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-0.5">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[var(--t-muted)]">{k}</dt>
          <dd className="tabular-nums text-[var(--t-text)]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Toggle({
  active,
  onClick,
  children,
  warn,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border px-1.5 py-0.5 text-[10px]",
        active
          ? "border-[var(--t-info)] text-[var(--t-info)]"
          : "border-[var(--t-border)] text-[var(--t-muted)]",
        warn && !active && "text-[var(--t-warning)]",
      )}
    >
      {children}
    </button>
  );
}

function formatUptime(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return "—";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

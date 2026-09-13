"use client";

import {
  Eye,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RotateCcw,
  Rows3,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMetricsSocket } from "@/lib/useMetricsSocket";
import type { MetricsEnvelope } from "@/lib/types";
import { clockNow } from "@/lib/terminal/format";
import { healthTone, toneColor } from "@/lib/terminal/theme";
import { useTerminalKeyboard } from "@/hooks/useTerminalKeyboard";
import {
  applyPositions,
  loadDashboard,
  saveDashboard,
} from "@/lib/dashboard/store";
import { defaultDashboard, PRESETS } from "@/lib/dashboard/presets";
import { getWidgetMeta, widgetHeight } from "@/lib/dashboard/registry";
import { iconMd, iconStroke, STATUS_ICONS } from "@/lib/dashboard/icons";
import {
  type DashboardConfig,
  type DashboardWidget,
  type LayoutMode,
  type WidgetType,
} from "@/lib/dashboard/types";
import type { GridStackWidget } from "gridstack";
import { HostList, type HostRow } from "./HostList";
import { DashboardWidgetView } from "./DashboardWidgetView";
import { AddWidgetModal } from "./AddWidgetModal";
import { TerminalEditModeProvider } from "./edit-mode";
import { LayoutModeProvider } from "./layout-mode";
import {
  GridStackBoard,
  type GridItemSpec,
  type GridStackBoardHandle,
} from "@/components/grid/GridStackBoard";
import { PreferenceControls } from "@/components/preferences/PreferenceControls";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
const VIEW_KEY = "pulsegrid.view";
const LEGACY_LAYOUT_KEY = "pulsegrid.grid.terminal.canvas";

function nextWidgetId(type: WidgetType, existing: DashboardWidget[]): string {
  let n = 1;
  const ids = new Set(existing.map((w) => w.id));
  while (ids.has(`${type}-${n}`)) n += 1;
  return `${type}-${n}`;
}

function placeNewWidget(
  type: WidgetType,
  existing: DashboardWidget[],
  mode: LayoutMode = "normal",
): DashboardWidget {
  const meta = getWidgetMeta(type);
  const maxY = existing.reduce((m, w) => Math.max(m, w.y + w.h), 0);
  return {
    id: nextWidgetId(type, existing),
    type,
    x: 0,
    y: maxY,
    w: meta.defaultW,
    h: widgetHeight(type, mode),
    minW: meta.minW,
    minH: meta.minH,
    config: {},
  };
}

export function TerminalShell() {
  const t = useTranslations();
  const { status, serverIds, getBuffer } = useMetricsSocket();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hostFilter, setHostFilter] = useState("");
  const [clock, setClock] = useState("--:--:--");
  const [frozenSample, setFrozenSample] = useState<MetricsEnvelope | null>(null);
  const [frozenHistory, setFrozenHistory] = useState<MetricsEnvelope[]>([]);
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const gridBoardRef = useRef<GridStackBoardHandle>(null);
  const saveTimer = useRef<number | null>(null);
  const dashboardRef = useRef(dashboard);
  dashboardRef.current = dashboard;

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, "terminal");
    // One-time cleanup of the old global canvas key.
    try {
      localStorage.removeItem(LEGACY_LAYOUT_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setClock(clockNow());
    const id = window.setInterval(() => {
      if (!paused) setTick((t) => t + 1);
      setClock(clockNow());
    }, 500);
    return () => window.clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (!selectedId && serverIds.length > 0) setSelectedId(serverIds[0]);
    if (selectedId && !serverIds.includes(selectedId)) {
      setSelectedId(serverIds[0] ?? null);
    }
  }, [serverIds, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDashboard(null);
      return;
    }
    setDashboard(loadDashboard(selectedId));
    setLayoutEpoch((e) => e + 1);
    setPresetOpen(false);
    setAddOpen(false);
    setLayoutOpen(false);
  }, [selectedId]);

  const hosts: HostRow[] = useMemo(() => {
    void tick;
    return serverIds
      .filter((id) =>
        hostFilter
          ? id.toLowerCase().includes(hostFilter.toLowerCase())
          : true,
      )
      .map((id) => {
        const buf = getBuffer(id) as MetricsEnvelope[];
        const last = buf[buf.length - 1];
        return {
          id,
          tone: healthTone(
            last?.cpu?.usagePercent != null && last.cpu.usagePercent >= 95
              ? "CRITICAL"
              : last?.cpu?.usagePercent != null && last.cpu.usagePercent >= 80
                ? "WARNING"
                : status === "connected"
                  ? "HEALTHY"
                  : "OFFLINE",
          ),
          cpu: last?.cpu?.usagePercent ?? 0,
        };
      });
  }, [serverIds, getBuffer, tick, status, hostFilter]);

  const liveSample = useMemo(() => {
    void tick;
    if (!selectedId) return null;
    const buf = getBuffer(selectedId) as MetricsEnvelope[];
    return buf[buf.length - 1] ?? null;
  }, [selectedId, getBuffer, tick]);

  const liveHistory = useMemo(() => {
    void tick;
    if (!selectedId) return [];
    return getBuffer(selectedId) as MetricsEnvelope[];
  }, [selectedId, getBuffer, tick]);

  useEffect(() => {
    if (paused) {
      setFrozenSample(liveSample);
      setFrozenHistory(liveHistory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const sample = paused ? frozenSample : liveSample;
  const history = paused ? frozenHistory : liveHistory;

  const selectDelta = useCallback(
    (delta: number) => {
      if (hosts.length === 0) return;
      const ids = hosts.map((h) => h.id);
      const idx = Math.max(0, ids.indexOf(selectedId ?? ids[0]));
      setSelectedId(ids[(idx + delta + ids.length) % ids.length]);
    },
    [hosts, selectedId],
  );

  useTerminalKeyboard(
    useCallback(
      (key, event) => {
        if (key === "ArrowDown") {
          event.preventDefault();
          selectDelta(1);
        } else if (key === "ArrowUp") {
          event.preventDefault();
          selectDelta(-1);
        } else if (key === " ") {
          event.preventDefault();
          setPaused((p) => !p);
        } else if (key === "e" || key === "E") {
          if (!event.metaKey && !event.ctrlKey) setEditMode((v) => !v);
        } else if (key === "?") {
          setShowHelp((v) => !v);
        } else if (key === "Escape") {
          setShowHelp(false);
          setEditMode(false);
          setAddOpen(false);
          setPresetOpen(false);
          setLayoutOpen(false);
        } else if (key.toLowerCase() === "t") {
          localStorage.setItem(VIEW_KEY, "gui");
          window.location.href = "/";
        }
      },
      [selectDelta],
    ),
  );

  useEffect(() => {
    if (!layoutOpen) return;
    const close = () => setLayoutOpen(false);
    const id = window.setTimeout(() => window.addEventListener("click", close), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("click", close);
    };
  }, [layoutOpen]);

  const counts = useMemo(() => {
    const c = { healthy: 0, warning: 0, critical: 0, offline: 0 };
    for (const h of hosts) {
      if (h.tone === "healthy") c.healthy++;
      else if (h.tone === "warning") c.warning++;
      else if (h.tone === "critical") c.critical++;
      else c.offline++;
    }
    return c;
  }, [hosts]);

  const persistDashboard = useCallback((next: DashboardConfig) => {
    setDashboard(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveDashboard(next);
    }, 500);
  }, []);

  const onGridPersist = useCallback(
    (positions: GridStackWidget[]) => {
      const current = dashboardRef.current;
      if (!current) return;
      const widgets = applyPositions(current.widgets, positions);
      persistDashboard({ ...current, widgets });
    },
    [persistDashboard],
  );

  const applyPreset = useCallback(
    (presetKey: string) => {
      if (!selectedId) return;
      const next = defaultDashboard(selectedId, presetKey);
      persistDashboard({
        ...next,
        layoutMode: dashboardRef.current?.layoutMode ?? "normal",
      });
      setLayoutEpoch((e) => e + 1);
      setPresetOpen(false);
    },
    [selectedId, persistDashboard],
  );

  const addWidget = useCallback(
    (type: WidgetType) => {
      const current = dashboardRef.current;
      if (!current || !selectedId) return;
      const mode = current.layoutMode ?? "normal";
      const widgets = [
        ...current.widgets,
        placeNewWidget(type, current.widgets, mode),
      ];
      persistDashboard({ ...current, widgets, preset: "custom" });
      setLayoutEpoch((e) => e + 1);
    },
    [selectedId, persistDashboard],
  );

  const removeWidget = useCallback(
    (id: string) => {
      const current = dashboardRef.current;
      if (!current) return;
      const widgets = current.widgets.filter((w) => w.id !== id);
      persistDashboard({ ...current, widgets, preset: "custom" });
      setLayoutEpoch((e) => e + 1);
    },
    [persistDashboard],
  );

  const resetLayout = useCallback(() => {
    if (!selectedId) return;
    const preset = dashboardRef.current?.preset ?? "general";
    const key = preset === "custom" || !PRESETS[preset] ? "general" : preset;
    applyPreset(key);
  }, [selectedId, applyPreset]);

  const applyLayoutMode = useCallback(
    (mode: LayoutMode) => {
      const current = dashboardRef.current;
      if (!current) return;
      const widgets = current.widgets.map((w) => ({
        ...w,
        h: widgetHeight(w.type, mode),
      }));
      persistDashboard({ ...current, layoutMode: mode, widgets });
      // Live GridStack update — no remount (avoids fighting ECharts).
      gridBoardRef.current?.applyLayoutMode(mode);
      setLayoutOpen(false);
    },
    [persistDashboard],
  );

  const gridDefaults: GridItemSpec[] = useMemo(
    () =>
      (dashboard?.widgets ?? []).map((w) => {
        const meta = getWidgetMeta(w.type);
        const mode = dashboard?.layoutMode ?? "normal";
        return {
          id: w.id,
          type: w.type,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h || widgetHeight(w.type, mode),
          minW: w.minW ?? meta.minW,
          minH: w.minH ?? meta.minH,
          maxH: meta.maxH,
        };
      }),
    [dashboard?.widgets, dashboard?.layoutMode],
  );

  const presetLabel = (() => {
    const key = dashboard?.preset ?? "general";
    if (key === "custom" || !PRESETS[key]) return t("presets.custom");
    return t(`presets.${key}` as "presets.general");
  })();

  return (
    <TerminalEditModeProvider editMode={editMode}>
      <div className="terminal-root flex h-dvh max-h-dvh flex-col overflow-hidden bg-[var(--t-bg)] text-[var(--t-text)]">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--t-border)] px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold tracking-[0.2em] text-[var(--t-info)]">
              PULSEGRID
            </span>
            <span className="text-[var(--t-muted)]">
              {t("common.hosts")} {hosts.length} · {t("common.healthy")}{" "}
              {counts.healthy} · {t("common.warn")} {counts.warning} ·{" "}
              {t("common.crit")} {counts.critical}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="metric-value text-[var(--t-muted)]">{clock}</span>
            <span
              className={
                status === "connected" && !paused
                  ? "text-[var(--t-healthy)]"
                  : "text-[var(--t-warning)]"
              }
            >
              {paused
                ? t("common.paused")
                : status === "connected"
                  ? `${t("common.live")} ●`
                  : status.toUpperCase()}
            </span>
            <PreferenceControls />
            <button
              type="button"
              className="border border-[var(--t-border)] px-2 py-0.5 hover:text-[var(--t-text)]"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? t("common.resume") : t("common.pause")}
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 border px-2 py-0.5",
                editMode
                  ? "border-[var(--t-info)] text-[var(--t-info)]"
                  : "border-[var(--t-border)] text-[var(--t-muted)]",
              )}
              onClick={() => setEditMode((v) => !v)}
            >
              {editMode ? (
                <Eye className={iconMd} strokeWidth={iconStroke} aria-hidden />
              ) : (
                <Pencil className={iconMd} strokeWidth={iconStroke} aria-hidden />
              )}
              {editMode ? t("common.done") : t("dashboard.editLayout")}
            </button>
            {editMode ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 border border-[var(--t-border)] px-2 py-0.5 text-[var(--t-muted)]"
                onClick={resetLayout}
              >
                <RotateCcw className={iconMd} strokeWidth={iconStroke} aria-hidden />
                {t("dashboard.resetLayout")}
              </button>
            ) : null}
            <Link
              href="/settings"
              className="border border-[var(--t-border)] px-2 py-0.5 text-[var(--t-muted)] hover:text-[var(--t-text)]"
            >
              {t("common.settings")}
            </Link>
            <Link
              href="/"
              className="border border-[var(--t-border)] px-2 py-0.5 text-[var(--t-muted)] hover:text-[var(--t-text)]"
              onClick={() => localStorage.setItem(VIEW_KEY, "gui")}
            >
              [GUI|TUI]
            </Link>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-[var(--t-border)] bg-[var(--t-panel)]">
            <div className="shrink-0 border-b border-[var(--t-border)] px-2 py-1 text-[11px] uppercase tracking-wider text-[var(--t-info)]">
              ┌─ {t("common.hosts")} ─
            </div>
            <div className="shrink-0 border-b border-[var(--t-border)] p-2">
              <div className="relative">
                <Search
                  className={cn(
                    iconMd,
                    "pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--t-muted)]",
                  )}
                  strokeWidth={iconStroke}
                  aria-hidden
                />
                <input
                  value={hostFilter}
                  onChange={(e) => setHostFilter(e.target.value)}
                  placeholder={t("common.search")}
                  className="w-full border border-[var(--t-border)] bg-[var(--t-bg)] py-1 pl-7 pr-2 text-xs text-[var(--t-text)] outline-none placeholder:text-[var(--t-muted)]"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <HostList
                hosts={hosts}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </aside>

          <main className="flex min-h-0 flex-col">
            <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-[var(--t-border)] px-3 py-1 font-mono text-xs text-[var(--t-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <LayoutDashboard
                  className={iconMd}
                  strokeWidth={iconStroke}
                  aria-hidden
                />
                <span>
                  {t("dashboard.title")} ·{" "}
                  <span className="text-[var(--t-text)]">
                    {selectedId ?? "—"}
                  </span>
                </span>
                {selectedId
                  ? (() => {
                      const tone =
                        hosts.find((h) => h.id === selectedId)?.tone ??
                        "unknown";
                      const StatusIcon = STATUS_ICONS[tone];
                      return (
                        <StatusIcon
                          className={iconMd}
                          strokeWidth={iconStroke}
                          style={{ color: toneColor(tone) }}
                          aria-hidden
                        />
                      );
                    })()
                  : null}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    className="border border-[var(--t-border)] px-2 py-0.5 hover:text-[var(--t-text)]"
                    onClick={() => setPresetOpen((v) => !v)}
                    disabled={!selectedId}
                  >
                    {presetLabel} ▾
                  </button>
                  {presetOpen ? (
                    <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] border border-[var(--t-border)] bg-[var(--t-panel)] py-1">
                      {Object.entries(PRESETS).map(([key, p]) => (
                        <button
                          key={key}
                          type="button"
                          className="block w-full px-3 py-1 text-left hover:bg-[var(--t-bg)] hover:text-[var(--t-info)]"
                          onClick={() => applyPreset(key)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 border border-[var(--t-border)] px-2 py-0.5 hover:text-[var(--t-info)] disabled:opacity-40"
                  onClick={() => setAddOpen(true)}
                  disabled={!selectedId}
                >
                  <Plus className={iconMd} strokeWidth={iconStroke} aria-hidden />
                  {t("dashboard.addWidget")}
                </button>
                <div className="relative">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 border border-[var(--t-border)] px-2 py-0.5 hover:text-[var(--t-info)] disabled:opacity-40"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLayoutOpen((v) => !v);
                      setPresetOpen(false);
                    }}
                    disabled={!selectedId}
                  >
                    <Rows3 className={iconMd} strokeWidth={iconStroke} aria-hidden />
                    {t("dashboard.layout")}
                    {" ▾"}
                  </button>
                  {layoutOpen ? (
                    <div
                      className="absolute right-0 top-full z-20 mt-1 min-w-[180px] border border-[var(--t-border)] bg-[var(--t-panel)] py-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(
                        [
                          {
                            mode: "normal" as const,
                            label: t("dashboard.layoutNormal"),
                            Icon: Rows3,
                          },
                          {
                            mode: "compact" as const,
                            label: t("dashboard.layoutCompact"),
                            Icon: Minimize2,
                          },
                          {
                            mode: "expanded" as const,
                            label: t("dashboard.layoutExpanded"),
                            Icon: Maximize2,
                          },
                        ] as const
                      ).map(({ mode, label, Icon }) => {
                        const active =
                          (dashboard?.layoutMode ?? "normal") === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--t-bg)] hover:text-[var(--t-info)]"
                            onClick={() => applyLayoutMode(mode)}
                          >
                            <span className="w-3">{active ? "✓" : ""}</span>
                            <Icon
                              className={iconMd}
                              strokeWidth={iconStroke}
                              aria-hidden
                            />
                            {label}
                          </button>
                        );
                      })}
                      <div className="my-1 border-t border-[var(--t-border)]" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--t-bg)] hover:text-[var(--t-info)]"
                        onClick={() => {
                          resetLayout();
                          setLayoutOpen(false);
                        }}
                      >
                        <span className="w-3" />
                        <RotateCcw
                          className={iconMd}
                          strokeWidth={iconStroke}
                          aria-hidden
                        />
                        {t("dashboard.resetLayout")}
                      </button>
                    </div>
                  ) : null}
                </div>
                <span className="inline-flex items-center gap-1">
                  {editMode ? (
                    <Pencil className={iconMd} strokeWidth={iconStroke} aria-hidden />
                  ) : (
                    <Eye className={iconMd} strokeWidth={iconStroke} aria-hidden />
                  )}
                  {editMode ? t("common.edit") : t("common.view")}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-2">
              {selectedId && dashboard ? (
                <LayoutModeProvider mode={dashboard.layoutMode ?? "normal"}>
                  <GridStackBoard
                    ref={gridBoardRef}
                    key={`${selectedId}-${layoutEpoch}`}
                    storageKey={`pulsegrid.dashboard.terminal.${selectedId}`}
                    defaults={gridDefaults}
                    editable={editMode}
                    onPersist={onGridPersist}
                    options={{
                      cellHeight: 32,
                      margin: 4,
                      float: true,
                      animate: true,
                    }}
                    className="terminal-gridstack min-h-[640px]"
                  >
                    {dashboard.widgets.map((widget) => (
                      <div
                        key={widget.id}
                        data-grid-id={widget.id}
                        className="h-full"
                      >
                        <DashboardWidgetView
                          widget={widget}
                          sample={sample}
                          history={history}
                          editMode={editMode}
                          onRemove={removeWidget}
                        />
                      </div>
                    ))}
                  </GridStackBoard>
                </LayoutModeProvider>
              ) : (
                <div className="p-4 text-xs text-[var(--t-muted)]">
                  {t("dashboard.selectHost")}
                </div>
              )}
            </div>
          </main>
        </div>

        <footer className="shrink-0 border-t border-[var(--t-border)] px-3 py-2 font-mono text-[11px] text-[var(--t-muted)]">
          [↑↓] Host · [Space] Pause · [E] Edit · [+ Widget] · Preset · [t] GUI ·
          [?] Help
        </footer>

        <AddWidgetModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdd={addWidget}
        />

        {showHelp ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md border border-[var(--t-border)] bg-[var(--t-panel)] p-4 font-mono text-xs">
              <div className="mb-2 text-[var(--t-info)]">
                ┌─ KEYBOARD SHORTCUTS ─
              </div>
              <pre className="whitespace-pre-wrap text-[var(--t-text)]">
                {`↑ ↓       Select host
Space     Pause / resume live
E         Toggle edit layout
t         GUI view
?         Help
Esc       Close / exit edit

Each host has its own dashboard layout.`}
              </pre>
              <button
                type="button"
                className="mt-3 border border-[var(--t-border)] px-2 py-1 text-[var(--t-muted)]"
                onClick={() => setShowHelp(false)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </TerminalEditModeProvider>
  );
}

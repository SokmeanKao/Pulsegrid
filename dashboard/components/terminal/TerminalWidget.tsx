"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  EllipsisVertical,
  GripVertical,
  Maximize2,
  Minimize2,
  Settings2,
  X,
} from "lucide-react";
import type { MetricsEnvelope } from "@/lib/types";
import type { WidgetType } from "@/lib/dashboard/types";
import { getWidgetMeta } from "@/lib/dashboard/registry";
import { iconMd, iconStroke } from "@/lib/dashboard/icons";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  useWidgetRuntime,
  WidgetBody,
  WidgetStateBadge,
} from "./widget-runtime";
import { LayoutModeProvider } from "./layout-mode";

type Props = {
  type: WidgetType;
  sample: MetricsEnvelope | null;
  children: ReactNode;
  className?: string;
  right?: ReactNode;
  titleSuffix?: string;
  editMode?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
};

function widgetTitleKey(type: WidgetType): string {
  switch (type) {
    case "proc-health":
      return "procHealth";
    case "top-cpu":
      return "topCpu";
    case "top-mem":
      return "topMem";
    default:
      return type;
  }
}

/** Shared terminal widget chrome — loading states + optional fullscreen. */
export function TerminalWidget({
  type,
  sample,
  children,
  className,
  right,
  titleSuffix,
  editMode = false,
  emptyMessage,
  onRetry,
}: Props) {
  const t = useTranslations("widgets");
  const tc = useTranslations("common");
  const meta = getWidgetMeta(type);
  const Icon = meta.icon;
  const [fullscreen, setFullscreen] = useState(false);
  const { state, error, ageMs } = useWidgetRuntime(type, sample);
  const showSuffix =
    titleSuffix &&
    (state === "ready" || state === "refreshing" || state === "stale");
  const baseTitle = t(widgetTitleKey(type) as "cpu").toUpperCase();
  const title = showSuffix ? `${baseTitle} · ${titleSuffix}` : baseTitle;

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const body = (
    <WidgetBody
      type={type}
      state={state}
      error={error}
      onRetry={onRetry}
      emptyMessage={emptyMessage}
    >
      {children}
    </WidgetBody>
  );

  return (
    <>
      <section
        className={cn(
          "flex h-full min-h-0 flex-col border border-[var(--t-border)] bg-[var(--t-panel)]",
          editMode && "ring-1 ring-[var(--t-info)]/40",
          state === "stale" && "border-[var(--t-warning)]/40",
          state === "error" && "border-[var(--t-critical)]/40",
          className,
        )}
      >
        <header
          className={cn(
            "flex shrink-0 items-center justify-between gap-2 border-b border-[var(--t-border)] px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-[var(--t-info)]",
            editMode ? "cursor-grab active:cursor-grabbing" : "cursor-default",
          )}
          title={editMode ? "Drag to rearrange" : undefined}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {editMode ? (
              <GripVertical
                className={cn(iconMd, "text-[var(--t-muted)]")}
                strokeWidth={iconStroke}
                aria-hidden
              />
            ) : null}
            <Icon
              className={cn(iconMd, "text-[var(--t-info)]")}
              strokeWidth={iconStroke}
              aria-hidden
            />
            <span className="truncate">┌─ {title} ─</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[var(--t-muted)]">
            <WidgetStateBadge state={state} ageMs={ageMs} />
            {right}
            <button
              type="button"
              className="inline-flex items-center p-0.5 hover:text-[var(--t-info)]"
              title="Fullscreen"
              onClick={(e) => {
                e.stopPropagation();
                setFullscreen(true);
              }}
            >
              <Maximize2 className={iconMd} strokeWidth={iconStroke} aria-hidden />
            </button>
            {editMode ? (
              <span className="flex items-center gap-0.5 opacity-70">
                <Settings2 className={iconMd} strokeWidth={iconStroke} aria-hidden />
                <EllipsisVertical
                  className={iconMd}
                  strokeWidth={iconStroke}
                  aria-hidden
                />
              </span>
            ) : null}
          </span>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 font-mono text-xs text-[var(--t-text)]">
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-auto">
            {body}
          </div>
        </div>
      </section>

      {fullscreen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col border border-[var(--t-border)] bg-[var(--t-panel)]">
            <header className="flex shrink-0 items-center justify-between border-b border-[var(--t-border)] px-3 py-2 font-mono text-xs text-[var(--t-info)]">
              <span className="inline-flex items-center gap-2">
                <Icon className={iconMd} strokeWidth={iconStroke} aria-hidden />
                {title}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 border border-[var(--t-border)] px-2 py-1 text-[var(--t-muted)] hover:text-[var(--t-text)]"
                onClick={() => setFullscreen(false)}
              >
                <Minimize2 className={iconMd} strokeWidth={iconStroke} aria-hidden />
                {tc("close")}
                <X className={iconMd} strokeWidth={iconStroke} aria-hidden />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs text-[var(--t-text)]">
              {/* Expanded profile charts for deep inspection */}
              <LayoutModeProvider mode="expanded">{body}</LayoutModeProvider>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

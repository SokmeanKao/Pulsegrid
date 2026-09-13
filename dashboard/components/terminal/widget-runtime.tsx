"use client";

import { useMemo, useState, useEffect, type ReactNode } from "react";
import {
  AlertTriangle,
  Inbox,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import type { MetricsEnvelope } from "@/lib/types";
import type { WidgetType } from "@/lib/dashboard/types";
import {
  deriveWidgetState,
  formatAge,
  type WidgetState,
} from "@/lib/dashboard/widget-state";
import { useMetricsSocket } from "@/lib/useMetricsSocket";
import { widgetSkeleton } from "./WidgetSkeletons";
import { iconSm, iconStroke } from "@/lib/dashboard/icons";

export function useWidgetRuntime(type: WidgetType, sample: MetricsEnvelope | null) {
  const { status } = useMetricsSocket();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(
    () => deriveWidgetState({ type, sample, connection: status, nowMs }),
    [type, sample, status, nowMs],
  );
}

export function WidgetEmpty({ message = "No data" }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[80px] flex-col items-center justify-center gap-2 text-[var(--t-muted)]">
      <Inbox className={iconSm} strokeWidth={iconStroke} aria-hidden />
      <p className="text-[11px]">{message}</p>
    </div>
  );
}

export function WidgetError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full min-h-[80px] flex-col items-center justify-center gap-2 px-2 text-center">
      <AlertTriangle
        className="size-5 text-[var(--t-warning)]"
        strokeWidth={iconStroke}
        aria-hidden
      />
      <p className="text-[11px] text-[var(--t-text)]">
        {message ?? "Unable to load metrics"}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="border border-[var(--t-border)] px-2 py-0.5 text-[10px] text-[var(--t-muted)] hover:text-[var(--t-info)]"
        >
          Retry
        </button>
      ) : (
        <p className="text-[10px] text-[var(--t-muted)]">
          Reconnects automatically
        </p>
      )}
    </div>
  );
}

export function WidgetStateBadge({
  state,
  ageMs,
}: {
  state: WidgetState;
  ageMs: number | null;
}) {
  if (state === "loading") {
    return (
      <LoaderCircle
        className="size-3.5 animate-spin text-[var(--t-muted)]"
        strokeWidth={iconStroke}
        aria-label="Loading"
      />
    );
  }
  if (state === "refreshing") {
    return (
      <RefreshCw
        className="size-3.5 animate-spin text-[var(--t-muted)]"
        strokeWidth={iconStroke}
        aria-label="Refreshing"
      />
    );
  }
  if (state === "stale") {
    return (
      <span className="text-[10px] normal-case tracking-normal text-[var(--t-warning)]">
        STALE{ageMs != null ? ` ${formatAge(ageMs)}` : ""}
      </span>
    );
  }
  if (state === "error") {
    return (
      <AlertTriangle
        className="size-3.5 text-[var(--t-warning)]"
        strokeWidth={iconStroke}
        aria-label="Error"
      />
    );
  }
  return null;
}

export function WidgetBody({
  type,
  state,
  error,
  onRetry,
  emptyMessage,
  children,
}: {
  type: WidgetType;
  state: WidgetState;
  error?: string;
  onRetry?: () => void;
  emptyMessage?: string;
  children: ReactNode;
}) {
  if (state === "loading") return widgetSkeleton(type);
  if (state === "error") return <WidgetError message={error} onRetry={onRetry} />;
  if (state === "empty") return <WidgetEmpty message={emptyMessage} />;
  // ready | refreshing | stale — keep previous content visible
  return children;
}

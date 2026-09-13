import type { ConnectionStatus, MetricsEnvelope } from "@/lib/types";
import type { WidgetType } from "./types";

export type WidgetState =
  | "loading"
  | "ready"
  | "refreshing"
  | "stale"
  | "empty"
  | "error";

export const WIDGET_STALE_MS = 10_000;
export const WIDGET_ERROR_MS = 30_000;

export type WidgetSliceResult = {
  /** Envelope exists and the relevant metric slice is usable. */
  hasData: boolean;
  /** Envelope exists but the slice is intentionally empty (no disks, no procs). */
  empty: boolean;
};

export function inspectWidgetSlice(
  type: WidgetType,
  sample: MetricsEnvelope | null,
): WidgetSliceResult {
  if (!sample) return { hasData: false, empty: false };

  switch (type) {
    case "cpu":
      return { hasData: sample.cpu != null, empty: false };
    case "memory":
      return { hasData: sample.memory != null, empty: false };
    case "disk":
      return {
        hasData: Array.isArray(sample.disks),
        empty: (sample.disks?.length ?? 0) === 0,
      };
    case "network":
      return {
        hasData: Array.isArray(sample.networks),
        empty: (sample.networks?.length ?? 0) === 0,
      };
    case "processes":
    case "top-cpu":
    case "top-mem":
      return {
        hasData: Array.isArray(sample.topProcesses),
        empty: (sample.topProcesses?.length ?? 0) === 0,
      };
    case "proc-health":
      if (sample.processSummary != null) {
        return { hasData: true, empty: false };
      }
      if ((sample.topProcesses?.length ?? 0) > 0) {
        return { hasData: true, empty: false };
      }
      return { hasData: true, empty: true };
    case "docker":
      // available=false is still usable UI (unavailable state), not empty/error
      return { hasData: sample.docker != null, empty: false };
    case "host":
      return { hasData: sample.hostExtras != null, empty: false };
    case "sensors": {
      const gpus = sample.sensors?.gpus?.length ?? 0;
      const temps = sample.sensors?.temperatures?.length ?? 0;
      if (sample.sensors == null) return { hasData: false, empty: false };
      return { hasData: true, empty: gpus + temps === 0 };
    }
    default:
      return { hasData: true, empty: false };
  }
}

export function deriveWidgetState(opts: {
  type: WidgetType;
  sample: MetricsEnvelope | null;
  connection: ConnectionStatus;
  nowMs?: number;
}): { state: WidgetState; error?: string; ageMs: number | null } {
  const now = opts.nowMs ?? Date.now();
  const ageMs =
    opts.sample?.collectedAtUnixMs != null
      ? Math.max(0, now - opts.sample.collectedAtUnixMs)
      : null;
  const slice = inspectWidgetSlice(opts.type, opts.sample);

  if (!opts.sample || !slice.hasData) {
    if (opts.connection === "disconnected") {
      return {
        state: "error",
        error: "Disconnected from metrics stream",
        ageMs,
      };
    }
    if (opts.connection === "reconnecting") {
      return {
        state: "loading",
        error: undefined,
        ageMs,
      };
    }
    return { state: "loading", ageMs };
  }

  if (slice.empty) {
    return { state: "empty", ageMs };
  }

  if (opts.connection === "reconnecting") {
    return { state: "refreshing", ageMs };
  }

  if (opts.connection === "disconnected") {
    if (ageMs != null && ageMs >= WIDGET_ERROR_MS) {
      return {
        state: "error",
        error: "Metrics stream disconnected",
        ageMs,
      };
    }
    return { state: "stale", ageMs };
  }

  if (ageMs != null && ageMs >= WIDGET_STALE_MS) {
    return { state: "stale", ageMs };
  }

  return { state: "ready", ageMs };
}

export function formatAge(ageMs: number | null | undefined): string {
  if (ageMs == null) return "";
  const s = Math.round(ageMs / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

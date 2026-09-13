import type { LucideIcon } from "lucide-react";
import {
  CircleCheck,
  CircleOff,
  CircleX,
  HelpCircle,
  Pause,
  Play,
  TriangleAlert,
} from "lucide-react";
import type { HealthTone } from "@/lib/terminal/theme";

export const STATUS_ICONS: Record<HealthTone, LucideIcon> = {
  healthy: CircleCheck,
  warning: TriangleAlert,
  critical: CircleX,
  offline: CircleOff,
  unknown: HelpCircle,
};

export function processStateIcon(state?: string): {
  Icon: LucideIcon;
  className: string;
  label: string;
} {
  const s = (state || "").toUpperCase();
  if (s === "RUNNING" || s === "R") {
    return {
      Icon: Play,
      className: "text-[var(--t-healthy)]",
      label: "Running",
    };
  }
  if (s === "ZOMBIE" || s === "Z") {
    return {
      Icon: TriangleAlert,
      className: "text-[var(--t-critical)]",
      label: "Zombie",
    };
  }
  if (s === "SLEEPING" || s === "S" || s === "WAITING" || s === "D" || s === "I") {
    return {
      Icon: Pause,
      className: "text-[var(--t-muted)]",
      label: s === "WAITING" || s === "D" ? "Waiting" : "Sleeping",
    };
  }
  return {
    Icon: Pause,
    className: "text-[var(--t-muted)]",
    label: state || "—",
  };
}

/** Shared Lucide sizing for Pulsegrid terminal UI. */
export const iconSm = "size-3.5 shrink-0";
export const iconMd = "size-4 shrink-0";
export const iconNav = "size-[18px] shrink-0";
export const iconStroke = 1.75;

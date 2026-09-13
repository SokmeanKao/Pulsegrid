export const terminalTheme = {
  bg: "#080b0d",
  panel: "#0d1115",
  border: "#2a3238",
  text: "#d7dde0",
  muted: "#7a858c",
  healthy: "#3dd68c",
  warning: "#f5c542",
  critical: "#ff5c5c",
  info: "#5cc8ff",
  offline: "#6b7280",
  accent: "#5cc8ff",
} as const;

export type HealthTone = "healthy" | "warning" | "critical" | "offline" | "unknown";

export function healthTone(health?: string): HealthTone {
  switch ((health || "").toUpperCase()) {
    case "HEALTHY":
      return "healthy";
    case "WARNING":
      return "warning";
    case "CRITICAL":
      return "critical";
    case "OFFLINE":
      return "offline";
    default:
      return "unknown";
  }
}

export function toneColor(tone: HealthTone): string {
  switch (tone) {
    case "healthy":
      return terminalTheme.healthy;
    case "warning":
      return terminalTheme.warning;
    case "critical":
      return terminalTheme.critical;
    case "offline":
      return terminalTheme.offline;
    default:
      return terminalTheme.muted;
  }
}

export function toneGlyph(tone: HealthTone): string {
  switch (tone) {
    case "healthy":
      return "●";
    case "warning":
      return "▲";
    case "critical":
      return "■";
    case "offline":
      return "○";
    default:
      return "·";
  }
}

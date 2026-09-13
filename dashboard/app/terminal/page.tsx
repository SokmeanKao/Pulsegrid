"use client";

import { MetricsProvider } from "@/lib/useMetricsSocket";
import { TerminalShell } from "@/components/terminal/TerminalShell";

export default function TerminalPage() {
  return (
    <MetricsProvider>
      <TerminalShell />
    </MetricsProvider>
  );
}

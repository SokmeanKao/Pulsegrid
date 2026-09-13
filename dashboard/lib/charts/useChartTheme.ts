"use client";

import { useEffect, useMemo, useState } from "react";
import { useResolvedColorMode } from "@/components/providers/AppProviders";
import {
  chartThemeFromCss,
  darkChartTheme,
  type PulsegridChartTheme,
} from "./theme";

/** Theme-aware chart tokens — updates when light/dark class changes. */
export function useChartTheme(): PulsegridChartTheme {
  const mode = useResolvedColorMode();
  const [theme, setTheme] = useState<PulsegridChartTheme>(darkChartTheme);

  useEffect(() => {
    setTheme(chartThemeFromCss());
  }, [mode]);

  return theme;
}

export function useThemedOption<T>(
  factory: (theme: PulsegridChartTheme) => T,
  deps: unknown[],
): T {
  const theme = useChartTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(theme), [theme, ...deps]);
}

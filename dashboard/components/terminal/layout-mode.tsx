"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LayoutMode } from "@/lib/dashboard/types";

const LayoutModeContext = createContext<LayoutMode>("normal");

export function LayoutModeProvider({
  mode,
  children,
}: {
  mode: LayoutMode;
  children: ReactNode;
}) {
  return (
    <LayoutModeContext.Provider value={mode}>
      {children}
    </LayoutModeContext.Provider>
  );
}

export function useLayoutMode(): LayoutMode {
  return useContext(LayoutModeContext);
}

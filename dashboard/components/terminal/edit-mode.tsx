"use client";

import { createContext, useContext } from "react";

const EditModeContext = createContext(false);

export function TerminalEditModeProvider({
  editMode,
  children,
}: {
  editMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <EditModeContext.Provider value={editMode}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useTerminalEditMode() {
  return useContext(EditModeContext);
}

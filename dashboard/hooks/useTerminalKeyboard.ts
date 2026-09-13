"use client";

import { useEffect } from "react";

type Handler = (key: string, event: KeyboardEvent) => void;

/** Ignore shortcuts while typing in inputs. */
export function useTerminalKeyboard(handler: Handler) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
        return;
      }
      handler(event.key, event);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}

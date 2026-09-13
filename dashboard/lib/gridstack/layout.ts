import type { GridStackWidget } from "gridstack";

export function loadLayout(key: string): GridStackWidget[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GridStackWidget[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLayout(key: string, widgets: GridStackWidget[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(widgets));
}

export function mergeLayout(
  defaults: GridStackWidget[],
  saved: GridStackWidget[] | null,
): GridStackWidget[] {
  if (!saved?.length) return defaults;
  const byId = new Map(saved.map((w) => [String(w.id), w]));
  return defaults.map((d) => {
    const s = byId.get(String(d.id));
    if (!s) return d;
    return { ...d, x: s.x, y: s.y, w: s.w, h: s.h };
  });
}

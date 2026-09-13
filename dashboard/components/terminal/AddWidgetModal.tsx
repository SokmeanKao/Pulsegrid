"use client";

import { useTranslations } from "next-intl";
import { WIDGET_CATALOG, WIDGET_REGISTRY } from "@/lib/dashboard/registry";
import { iconMd, iconStroke } from "@/lib/dashboard/icons";
import type { WidgetType } from "@/lib/dashboard/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (type: WidgetType) => void;
};

const CATEGORIES = ["SYSTEM", "STORAGE", "NETWORK", "PROCESSES"] as const;

function labelKey(type: WidgetType): string {
  switch (type) {
    case "proc-health":
      return "procHealth";
    case "top-cpu":
      return "topCpu";
    case "top-mem":
      return "topMem";
    default:
      return type;
  }
}

export function AddWidgetModal({ open, onClose, onAdd }: Props) {
  const t = useTranslations("widgets");
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-auto border border-[var(--t-border)] bg-[var(--t-panel)] p-4 text-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[var(--t-info)]">
            ┌─ {t("addWidgetTitle").toUpperCase()} ─
          </div>
          <button
            type="button"
            className="text-[var(--t-muted)] hover:text-[var(--t-text)]"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {CATEGORIES.map((cat) => {
          const items = WIDGET_CATALOG.filter((c) => c.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--t-muted)]">
                {cat}
              </div>
              <div className="flex flex-col gap-1">
                {items.map((item) => {
                  const Icon = WIDGET_REGISTRY[item.type].icon;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      className="flex items-center gap-2 border border-[var(--t-border)] px-2 py-1.5 text-left text-[var(--t-text)] hover:border-[var(--t-info)] hover:text-[var(--t-info)]"
                      onClick={() => {
                        onAdd(item.type);
                        onClose();
                      }}
                    >
                      <Icon
                        className={iconMd}
                        strokeWidth={iconStroke}
                        aria-hidden
                      />
                      <span>{t(labelKey(item.type) as "cpu")}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

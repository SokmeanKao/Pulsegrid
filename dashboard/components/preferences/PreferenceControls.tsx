"use client";

import { useEffect, useState } from "react";
import { Globe2, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useAppLocale } from "@/components/providers/AppProviders";
import {
  localeLabels,
  locales,
  type AppLocale,
} from "@/lib/i18n/config";
import { iconMd, iconStroke } from "@/lib/dashboard/icons";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark" | "system";

const themes: { value: ThemeMode; icon: typeof Sun; labelKey: string }[] = [
  { value: "light", icon: Sun, labelKey: "themeLight" },
  { value: "dark", icon: Moon, labelKey: "themeDark" },
  { value: "system", icon: Monitor, labelKey: "themeSystem" },
];

function MenuButton({
  open,
  onToggle,
  children,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      className="inline-flex items-center gap-1.5 border border-[var(--t-border)] px-2 py-0.5 text-[var(--t-muted)] hover:text-[var(--t-text)]"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {children}
    </button>
  );
}

function Dropdown({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      // defer so the toggle click that opened the menu doesn't close it
      if (e.defaultPrevented) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.setTimeout(() => {
      window.addEventListener("click", onClick);
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="absolute right-0 top-full z-30 mt-1 min-w-[160px] border border-[var(--t-border)] bg-[var(--t-panel)] py-1 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function PreferenceControls({ className }: { className?: string }) {
  const t = useTranslations("dashboard");
  const { locale, setLocale } = useAppLocale();
  const { theme, setTheme } = useTheme();
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const ThemeIcon =
    !mounted || theme === "system"
      ? Monitor
      : theme === "light"
        ? Sun
        : Moon;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="relative">
        <MenuButton
          open={langOpen}
          label={t("language")}
          onToggle={() => {
            setLangOpen((v) => !v);
            setThemeOpen(false);
          }}
        >
          <Globe2 className={iconMd} strokeWidth={iconStroke} aria-hidden />
          <span className="uppercase">{locale}</span>
          <span aria-hidden>▾</span>
        </MenuButton>
        <Dropdown open={langOpen} onClose={() => setLangOpen(false)}>
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--t-muted)]">
            {t("language")}
          </div>
          {locales.map((code) => (
            <button
              key={code}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--t-bg)] hover:text-[var(--t-info)]",
                locale === code && "text-[var(--t-info)]",
              )}
              onClick={() => {
                setLocale(code as AppLocale);
                setLangOpen(false);
              }}
            >
              <span className="w-3">{locale === code ? "✓" : ""}</span>
              <span>{localeLabels[code].native}</span>
            </button>
          ))}
        </Dropdown>
      </div>

      <div className="relative">
        <MenuButton
          open={themeOpen}
          label={t("appearance")}
          onToggle={() => {
            setThemeOpen((v) => !v);
            setLangOpen(false);
          }}
        >
          <ThemeIcon className={iconMd} strokeWidth={iconStroke} aria-hidden />
          <span aria-hidden>▾</span>
        </MenuButton>
        <Dropdown open={themeOpen} onClose={() => setThemeOpen(false)}>
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--t-muted)]">
            {t("appearance")}
          </div>
          {themes.map((item) => {
            const Icon = item.icon;
            const active = mounted && theme === item.value;
            return (
              <button
                key={item.value}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--t-bg)] hover:text-[var(--t-info)]",
                  active && "text-[var(--t-info)]",
                )}
                onClick={() => {
                  setTheme(item.value);
                  setThemeOpen(false);
                }}
              >
                <span className="w-3">{active ? "✓" : ""}</span>
                <Icon className={iconMd} strokeWidth={iconStroke} aria-hidden />
                <span>{t(item.labelKey as "themeLight")}</span>
              </button>
            );
          })}
        </Dropdown>
      </div>
    </div>
  );
}

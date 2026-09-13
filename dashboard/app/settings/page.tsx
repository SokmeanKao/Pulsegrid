"use client";

import { useTranslations } from "next-intl";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PreferenceControls } from "@/components/preferences/PreferenceControls";
import { useAppLocale } from "@/components/providers/AppProviders";
import {
  localeLabels,
  locales,
  type AppLocale,
} from "@/lib/i18n/config";
import { iconMd, iconStroke } from "@/lib/dashboard/icons";
import { cn } from "@/lib/utils";

const themes = [
  { value: "light" as const, icon: Sun, labelKey: "themeLight" as const },
  { value: "dark" as const, icon: Moon, labelKey: "themeDark" as const },
  { value: "system" as const, icon: Monitor, labelKey: "themeSystem" as const },
];

export default function SettingsPage() {
  const t = useTranslations();
  const { locale, setLocale } = useAppLocale();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-dvh bg-[var(--t-bg)] text-[var(--t-text)]">
      <header className="flex items-center justify-between border-b border-[var(--t-border)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/terminal"
            className="font-semibold tracking-[0.2em] text-[var(--t-info)]"
          >
            PULSEGRID
          </Link>
          <span className="text-sm text-[var(--t-muted)]">
            {t("common.settings")}
          </span>
        </div>
        <PreferenceControls />
      </header>

      <main className="mx-auto max-w-lg space-y-8 p-6">
        <section>
          <h1 className="mb-1 text-lg font-semibold">{t("common.settings")}</h1>
          <p className="text-sm text-[var(--t-muted)]">
            {t("dashboard.appearance")} · {t("dashboard.language")}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-[var(--t-info)]">
            {t("dashboard.appearance")}
          </h2>
          <div className="flex flex-col gap-1 border border-[var(--t-border)] bg-[var(--t-panel)] p-2">
            {themes.map((item) => {
              const Icon = item.icon;
              const active = mounted && theme === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--t-bg)]",
                    active && "text-[var(--t-info)]",
                  )}
                  onClick={() => setTheme(item.value)}
                >
                  <span className="w-4">{active ? "●" : "○"}</span>
                  <Icon className={iconMd} strokeWidth={iconStroke} aria-hidden />
                  <span>{t(`dashboard.${item.labelKey}`)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-[var(--t-info)]">
            {t("dashboard.language")}
          </h2>
          <div className="flex flex-col gap-1 border border-[var(--t-border)] bg-[var(--t-panel)] p-2">
            {locales.map((code) => (
              <button
                key={code}
                type="button"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--t-bg)]",
                  locale === code && "text-[var(--t-info)]",
                )}
                onClick={() => setLocale(code as AppLocale)}
              >
                <span className="w-4">{locale === code ? "●" : "○"}</span>
                <span>{localeLabels[code].native}</span>
                <span className="text-[var(--t-muted)]">
                  ({localeLabels[code].english})
                </span>
              </button>
            ))}
          </div>
        </section>

        <p className="text-xs text-[var(--t-muted)]">
          Preferences apply immediately and are stored in this browser (
          <code className="metric-value">pulsegrid.theme</code>,{" "}
          <code className="metric-value">pulsegrid.locale</code>). Machine
          dashboard layouts stay separate.
        </p>

        <Link
          href="/terminal"
          className="inline-block border border-[var(--t-border)] px-3 py-1.5 text-sm text-[var(--t-muted)] hover:text-[var(--t-text)]"
        >
          ← {t("dashboard.title")}
        </Link>
      </main>
    </div>
  );
}

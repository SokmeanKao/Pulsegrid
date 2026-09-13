export const locales = ["en", "km", "ko"] as const;

export type AppLocale = (typeof locales)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

export const LOCALE_STORAGE_KEY = "pulsegrid.locale";
export const THEME_STORAGE_KEY = "pulsegrid.theme";

export const localeLabels: Record<
  AppLocale,
  { native: string; english: string }
> = {
  en: { native: "English", english: "English" },
  km: { native: "ខ្មែរ", english: "Khmer" },
  ko: { native: "한국어", english: "Korean" },
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function readStoredLocale(): AppLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isAppLocale(raw) ? raw : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function writeStoredLocale(locale: AppLocale) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import { DICTIONARY, interpolate, type Locale, type MessageKey } from "@/lib/i18n/dictionary";

const STORAGE_KEY = "ags-dismissal:locale";

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") return stored;
    // First visit: follow the browser.
    return navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en";
  } catch {
    return "en";
  }
}

const listeners = new Set<() => void>();
let current: Locale | null = null;

function getSnapshot(): Locale {
  if (current === null) current = readStoredLocale();
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyToDocument(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = locale === "ar" ? "rtl" : "ltr";
}

/**
 * Bilingual UI. The choice is per device (localStorage) and applied to
 * <html lang dir>, so every Tailwind logical property flips with it.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  // The server (and the first client paint) render English; the stored
  // choice is swapped in by useSyncExternalStore without a setState cascade.
  const locale = useSyncExternalStore(subscribe, getSnapshot, () => "en" as Locale);

  React.useEffect(() => {
    applyToDocument(locale);
  }, [locale]);

  const setLocale = React.useCallback((next: Locale) => {
    current = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference simply won't persist.
    }
    listeners.forEach((listener) => listener());
  }, []);

  const t = React.useCallback<I18nContextValue["t"]>(
    (key, values) => interpolate(DICTIONARY[locale][key] ?? DICTIONARY.en[key] ?? key, values),
    [locale],
  );

  const value = React.useMemo<I18nContextValue>(
    () => ({ locale, dir: locale === "ar" ? "rtl" : "ltr", setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = React.useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside <I18nProvider>.");
  return context;
}

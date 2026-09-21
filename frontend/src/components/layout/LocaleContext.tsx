"use client";

import { createContext, useContext } from "react";

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/directory";

const LocaleContext = createContext<Locale | null>(null);

/** The language of the page being shown, decided on the server from the address, so server and browser agree. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function usePageLocale(): Locale | null {
  return useContext(LocaleContext);
}

export function useLocaleOrDefault(): Locale {
  return useContext(LocaleContext) ?? DEFAULT_LOCALE;
}

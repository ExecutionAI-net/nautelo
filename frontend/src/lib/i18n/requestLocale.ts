import { cookies } from "next/headers";

import { DEFAULT_LOCALE, resolveLocale, type Locale } from "@/lib/i18n/directory";

export const LOCALE_COOKIE = "nauta_locale";

/** The visitor's chosen language for server-rendered pages (cookie set by the language switcher). */
export async function getRequestLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    return resolveLocale(store.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE);
  } catch {
    return DEFAULT_LOCALE;
  }
}

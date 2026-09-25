import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE, resolveLocale, type Locale } from "@/lib/i18n/directory";

export const LOCALE_COOKIE = "nauta_locale";

/**
 * The language of this request. The address decides (the proxy writes it into a header): /it/... is Italian, the
 * root is English. The saved cookie is only a fallback for routes that do not pass through the proxy.
 */
export async function getRequestLocale(): Promise<Locale> {
  try {
    const fromAddress = (await headers()).get("x-nauta-locale");
    if (fromAddress) return resolveLocale(fromAddress);
    const store = await cookies();
    return resolveLocale(store.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE);
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** The address of this request without its language prefix ("/boats/"), for canonical and hreflang links. */
export async function getRequestPath(): Promise<string> {
  try {
    return (await headers()).get("x-nauta-path") ?? "/";
  } catch {
    return "/";
  }
}

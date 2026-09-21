"use client";

import { useSyncExternalStore } from "react";

import { usePageLocale } from "@/components/layout/LocaleContext";

import { useSession } from "@/lib/auth/session";
import { resolveLocale, type Locale } from "@/lib/i18n/directory";

const LOCALE_COOKIE = "nauta_locale";

export function readLocaleCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(LOCALE_COOKIE.length + 1)) : null;
}

export function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/** The visitor's language: their chosen cookie first, then the account locale, then English. */
const subscribe = () => () => {};

export function useLocale(): Locale {
  const pageLocale = usePageLocale();
  const { session } = useSession();
  // The cookie only changes together with a reload, so there is nothing to subscribe to.
  const cookieLocale = useSyncExternalStore(subscribe, readLocaleCookie, () => null);
  if (pageLocale) return pageLocale;
  return cookieLocale ? resolveLocale(cookieLocale) : resolveLocale(session?.user?.locale);
}

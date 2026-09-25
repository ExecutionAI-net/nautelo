import type { Locale } from "@/lib/i18n/directory";

// English readers on this platform are European: day before month, 24-hour clock.
const TAG: Record<Locale, string> = { en: "en-GB", it: "it-IT", es: "es-ES" };

/** "23 Sep 2026, 21:30" - the one stamp format for dashboards (messages, notifications). No seconds. */
export function formatDateTime(locale: Locale, iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(TAG[locale] ?? "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** "23 Sep 2026". */
export function formatDate(locale: Locale, iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(TAG[locale] ?? "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

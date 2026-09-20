"use client";

import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/directory";
import { useLocale, writeLocaleCookie } from "@/lib/i18n/useLocale";

/** EN / IT / ES pills from the design; stores the choice in a cookie and re-renders server pages. */
export default function LanguageSwitcher() {
  const current = useLocale();

  function choose(locale: Locale) {
    writeLocaleCookie(locale);
    // Server pages read the cookie per request and client components on mount; a reload updates both.
    window.location.reload();
  }

  return (
    <div role="group" aria-label="Language" className="inline-flex rounded-full bg-surface-container p-0.5 font-label-sm text-label-sm">
      {SUPPORTED_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={current === locale}
          onClick={() => choose(locale)}
          className={`rounded-full px-2.5 py-1 uppercase ${current === locale ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-primary"}`}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}

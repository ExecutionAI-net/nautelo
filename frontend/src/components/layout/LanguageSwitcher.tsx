"use client";

import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/directory";
import { localizePath, splitLocalePath } from "@/lib/i18n/localePath";
import { useLocale, writeLocaleCookie } from "@/lib/i18n/useLocale";

/** EN / IT / ES pills from the design; opens the same page at the chosen language's address and remembers the choice. */
export default function LanguageSwitcher() {
  const current = useLocale();

  function choose(locale: Locale) {
    writeLocaleCookie(locale);
    // Each language has its own address: go to this same page in the chosen language.
    const { path } = splitLocalePath(window.location.pathname);
    window.location.assign(`${localizePath(path, locale)}${window.location.search}${window.location.hash}`);
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

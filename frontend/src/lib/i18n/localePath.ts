// English lives at the root of the site; Italian and Spanish live under /it/ and /es/ (one address per language,
// so search engines can index each and tell them apart with hreflang).
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/directory";

const PREFIXED = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);
const PREFIX_RE = new RegExp(`^/(${PREFIXED.join("|")})(?=/|$)`);

export function prefixFor(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "" : `/${locale}`;
}

/** The address without its language prefix, and the language the prefix named (English when there is none). */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } {
  const match = PREFIX_RE.exec(pathname);
  if (!match) return { locale: DEFAULT_LOCALE, path: pathname };
  return { locale: match[1] as Locale, path: pathname.slice(match[0].length) || "/" };
}

/** Put a site path into a language. Anything that is not a plain site path (external, #anchor, ?query, /api) is left alone. */
export function localizePath(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path.startsWith("/api/") || path.startsWith("/_next/") || PREFIX_RE.test(path)) return path;
  return `${prefixFor(locale)}${path}`;
}

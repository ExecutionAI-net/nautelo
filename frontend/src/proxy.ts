import { NextResponse, type NextRequest } from "next/server";

// One address per language: English at the root, Italian under /it/, Spanish under /es/.
// A prefixed request is served by the same pages (rewrite) and told which language it is in through a header;
// a visitor whose saved choice is Italian or Spanish and who lands on an unprefixed page is sent to their language.

const LOCALE_COOKIE = "nauta_locale";
const PREFIXED = ["it", "es"];
const PREFIX_RE = /^\/(it|es)(\/.*)?$/;

// A visitor with no saved choice yet is matched against their browser's
// language (customer feedback, 2026-09-25); anything we don't have falls
// back to English. `Accept-Language` lists tags most-preferred first, each
// optionally weighted with `;q=`, e.g. "it-IT,it;q=0.9,en;q=0.8".
function preferredFromAcceptLanguage(header: string | null): string {
  if (!header) return "en";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.split("-")[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((entry) => PREFIXED.includes(entry.tag))?.tag ?? "en";
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const match = PREFIX_RE.exec(pathname);
  const headers = new Headers(request.headers);

  if (match) {
    const locale = match[1];
    const path = match[2] || "/";
    headers.set("x-nauta-locale", locale);
    headers.set("x-nauta-path", path);
    const target = request.nextUrl.clone();
    target.pathname = path;
    const response = NextResponse.rewrite(target, { request: { headers } });
    response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
    return response;
  }

  const hasCookie = request.cookies.has(LOCALE_COOKIE);
  const saved = request.cookies.get(LOCALE_COOKIE)?.value ?? "";
  const preferred = hasCookie ? saved : preferredFromAcceptLanguage(request.headers.get("accept-language"));
  if (PREFIXED.includes(preferred) && request.method === "GET") {
    const target = request.nextUrl.clone();
    target.pathname = `/${preferred}${pathname}`;
    target.search = search;
    const response = NextResponse.redirect(target, 307);
    response.headers.append("Vary", "Cookie, Accept-Language");
    // A browser-language match is saved too, so it only has to be computed once.
    if (!hasCookie) response.cookies.set(LOCALE_COOKIE, preferred, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
    return response;
  }

  headers.set("x-nauta-locale", "en");
  headers.set("x-nauta-path", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages only: not the API, Next's own files, or anything with a file extension (images, icons, sitemap.xml, robots.txt).
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};

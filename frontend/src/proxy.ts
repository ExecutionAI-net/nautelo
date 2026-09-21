import { NextResponse, type NextRequest } from "next/server";

// One address per language: English at the root, Italian under /it/, Spanish under /es/.
// A prefixed request is served by the same pages (rewrite) and told which language it is in through a header;
// a visitor whose saved choice is Italian or Spanish and who lands on an unprefixed page is sent to their language.

const LOCALE_COOKIE = "nauta_locale";
const PREFIXED = ["it", "es"];
const PREFIX_RE = /^\/(it|es)(\/.*)?$/;

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

  const saved = request.cookies.get(LOCALE_COOKIE)?.value ?? "";
  if (PREFIXED.includes(saved) && request.method === "GET") {
    const target = request.nextUrl.clone();
    target.pathname = `/${saved}${pathname}`;
    target.search = search;
    const response = NextResponse.redirect(target, 307);
    response.headers.append("Vary", "Cookie");
    return response;
  }

  headers.set("x-nauta-locale", "en");
  headers.set("x-nauta-path", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages only: not the API, Next's own files, or anything with a file extension (images, icons, sitemap.xml, robots.txt).
  matcher: ["/((?!api/|_next/|.*\..*).*)"],
};

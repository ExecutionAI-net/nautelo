import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { MATERIAL_SYMBOLS_URL } from "@/lib/icons";

import { clientMessages, loadMessages } from "@/i18n/server";
import { MessagesProvider } from "@/i18n/client";
import { LocaleProvider } from "@/components/layout/LocaleContext";
import PrimaryNav from "@/components/layout/PrimaryNav";
import SiteFooter from "@/components/layout/SiteFooter";
import { SessionProvider } from "@/lib/auth/session";
import { SUPPORTED_LOCALES } from "@/lib/i18n/directory";
import { getRequestLocale, getRequestPath } from "@/lib/i18n/requestLocale";
import { prefixFor } from "@/lib/i18n/localePath";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair-display",
  weight: ["400", "500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://127.0.0.1:3020").replace(/\/$/, "");

// Every page gets its own address in each language, a canonical link to itself and hreflang links to the others
// (English is the default for visitors whose language is not offered). Pages must not set their own canonical.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const path = await getRequestPath();
  const languages: Record<string, string> = Object.fromEntries(
    SUPPORTED_LOCALES.map((code) => [code, `${SITE_URL}${prefixFor(code)}${path}`]),
  );
  languages["x-default"] = `${SITE_URL}${path}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: "Nautelo", template: "%s · Nautelo" },
    description: "Yacht and boat marketplace for Spain and Italy",
    alternates: { canonical: `${SITE_URL}${prefixFor(locale)}${path}`, languages },
  };
}


export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  const messages = clientMessages(await loadMessages(locale));
  return (
    <html lang={locale}>
      <head>
        {/* Shaves the connection setup (DNS + TLS) off the critical path for the
            Material Symbols request below, instead of starting it only once the
            browser parses the <link> tag. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* The icon stylesheet is fetched at once (preload) but applied only once it has
            arrived: a `media="print"` sheet does not block the first paint, and the tiny
            script switches it to `all` on load (Lighthouse "Render-blocking requests").
            Icons have a fixed box in CSS, so the late swap causes no layout shift. */}
        <link rel="preload" as="style" href={MATERIAL_SYMBOLS_URL} />
        <link href={MATERIAL_SYMBOLS_URL} rel="stylesheet" media="print" data-icon-font="" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var l=document.querySelector('link[data-icon-font]');if(!l)return;var on=function(){l.media='all'};l.addEventListener('load',on);if(l.sheet){on()}})();",
          }}
        />
        <noscript>
          <link href={MATERIAL_SYMBOLS_URL} rel="stylesheet" />
        </noscript>
      </head>
      <body
        className={`${playfairDisplay.variable} ${plusJakartaSans.variable} bg-surface text-on-surface antialiased`}
      >
        <LocaleProvider locale={locale}>
          <MessagesProvider messages={messages}>
            <SessionProvider>
              <PrimaryNav />
              {children}
              <SiteFooter />
            </SessionProvider>
          </MessagesProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

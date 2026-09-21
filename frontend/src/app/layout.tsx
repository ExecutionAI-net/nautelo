import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

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
    title: { default: "NAUTA", template: "%s · NAUTA" },
    description: "Yacht and boat marketplace for Spain and Italy",
    alternates: { canonical: `${SITE_URL}${prefixFor(locale)}${path}`, languages },
  };
}

// Only the icons the app uses (the full font is ~4 MB). Add a name here when a
// new icon is introduced; keep the list alphabetical, as Google Fonts requires.
const MATERIAL_SYMBOLS_ICONS =
  "3d_rotation,ac_unit,account_balance,add_circle,add_photo_alternate,ads_click,alt_route,analytics,anchor,architecture,arrow_downward,arrow_forward,arrow_outward,arrows_outward,article,assignment,assignment_turned_in,assured_workload,badge,balance,bed,bolt,build,calendar_today,call,campaign,category,check,check_circle,chevron_right,close,cloud_upload,compare_arrows,delete,description,desktop_windows,directions_boat,dock,domain,draw,east,edit_note,engineering,euro,expand_more,explore,fact_check,file_upload_off,flag,flight,fmd_good,gavel,group,handshake,handyman,headset_mic,home,hub,imagesmode,info,language,library_books,local_gas_station,local_shipping,location_on,lock,lock_open,mail,manage_search,menu,menu_book,menu_open,military_tech,mood,navigation,near_me,north_east,notifications,open_in_new,pace,pause_circle,payments,pending_actions,person,phone_in_talk,photo_camera,picture_as_pdf,pin_drop,policy,precision_manufacturing,price_check,print,public,qr_code_2,real_estate_agent,receipt_long,refresh,rule,rv_hookup,sailing,satellite_alt,schedule,school,search,search_check,security,send,settings,settings_suggest,share,shield,shield_with_heart,shower,south,speed,straighten,support_agent,terminal,timer,trending_up,tune,upload_file,verified,verified_user,videocam,view_in_ar,visibility,watch,water,water_drop";
const MATERIAL_SYMBOLS_URL = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=${MATERIAL_SYMBOLS_ICONS}&display=block`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  const messages = clientMessages(await loadMessages(locale));
  return (
    <html lang={locale}>
      <head>
        <link
          href={MATERIAL_SYMBOLS_URL}
          rel="stylesheet"
        />
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

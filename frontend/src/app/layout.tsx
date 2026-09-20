import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

import PrimaryNav from "@/components/layout/PrimaryNav";
import SiteFooter from "@/components/layout/SiteFooter";
import { SessionProvider } from "@/lib/auth/session";

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

export const metadata: Metadata = {
  title: "NAUTA",
  description: "Yacht and boat marketplace for Spain and Italy",
};

// Only the icons the app uses (the full font is ~4 MB). Add a name here when a
// new icon is introduced; keep the list alphabetical, as Google Fonts requires.
const MATERIAL_SYMBOLS_ICONS =
  "3d_rotation,ac_unit,account_balance,add_circle,add_photo_alternate,ads_click,alt_route,analytics,anchor,architecture,arrow_downward,arrow_forward,arrow_outward,arrows_outward,article,assignment,assignment_turned_in,assured_workload,badge,balance,bed,bolt,build,calendar_today,call,campaign,category,check,check_circle,chevron_right,close,cloud_upload,compare_arrows,delete,description,desktop_windows,directions_boat,dock,domain,draw,east,edit_note,engineering,euro,expand_more,explore,fact_check,file_upload_off,flag,flight,fmd_good,gavel,group,handshake,handyman,headset_mic,home,hub,imagesmode,info,language,library_books,local_gas_station,local_shipping,location_on,lock,lock_open,mail,manage_search,menu_book,military_tech,navigation,near_me,north_east,open_in_new,pace,pause_circle,payments,pending_actions,person,phone_in_talk,photo_camera,picture_as_pdf,pin_drop,policy,precision_manufacturing,price_check,print,public,qr_code_2,real_estate_agent,receipt_long,refresh,rule,rv_hookup,sailing,satellite_alt,schedule,school,search,search_check,security,send,settings,settings_suggest,share,shield,shield_with_heart,shower,south,speed,straighten,support_agent,terminal,timer,trending_up,tune,upload_file,verified,verified_user,videocam,view_in_ar,visibility,watch,water,water_drop";
const MATERIAL_SYMBOLS_URL = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=${MATERIAL_SYMBOLS_ICONS}&display=block`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          href={MATERIAL_SYMBOLS_URL}
          rel="stylesheet"
        />
      </head>
      <body
        className={`${playfairDisplay.variable} ${plusJakartaSans.variable} bg-surface text-on-surface antialiased`}
      >
        <SessionProvider>
          <PrimaryNav />
          {children}
          <SiteFooter />
        </SessionProvider>
      </body>
    </html>
  );
}

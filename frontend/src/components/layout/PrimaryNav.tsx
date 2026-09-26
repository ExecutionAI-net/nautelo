"use client";

import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n";
import { splitLocalePath } from "@/lib/i18n/localePath";
import { useLocale } from "@/lib/i18n/useLocale";
import Link from "@/components/layout/LocaleLink";
import { usePathname } from "next/navigation";
import { useState } from "react";

import NotificationBell from "@/components/layout/NotificationBell";
import { accountHrefFor, isBrokerAccount } from "@/lib/auth/home";
import { useSession } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/auth/types";
import { tConversations } from "@/lib/i18n/conversations";

interface NavLink {
  href: string;
  /** The site-text key of the visible name. */
  label?: MessageKey;
  /** A key in CONVERSATION_MESSAGES, resolved per the viewer's locale.
   *
   * New UI text must be an EN/IT/ES key (spec 37), so this phase's entry uses
   * this rather than `label`. The existing entries are NOT converted here:
   * retro-fitting six labels into a dictionary is a change to Phase 3's
   * component with its own copy decisions (what is "Boats" in Italian on a
   * marketplace that has not shipped a boats page?), and this plan's charter is
   * spec 28. Recorded as Known Limitation 18, beside the related observation
   * that the same six links point at pages that do not exist. */
  messageKey?: string;
  permission?: PermissionKey;
  /** Some entries are gated on membership rather than on a spec 5 capability:
   * spec 5's table has no "broker dashboard" row, and an AGENT with every flag
   * false is still a member of the organization. */
  requiresBrokerMembership?: boolean;
  /** Shown to anyone who can create either kind of listing. */
  requiresListingRight?: boolean;
}

// Public routes come from spec 4.1; the gated ones from spec 5's capability table.
const LINKS: NavLink[] = [
  { href: "/boats/", label: "nav.buy" },
  { href: "/services/professionals/", label: "nav.services" },
  { href: "/brokers/", label: "nav.brokers" },
  { href: "/financing/", label: "nav.financing" },
  { href: "/guides/", label: "nav.guides" },
  { href: "/pricing/", label: "nav.pricing" },
  { href: "/sell/", label: "nav.sell", permission: "create_private_listing" },
  { href: "/dashboard/private-seller/listings/", label: "nav.my_listings", requiresListingRight: true },
  { href: "/dashboard/broker/fleet/", label: "nav.fleet", permission: "create_broker_listing" },
  {
    href: "/dashboard/broker/",
    // Spec 37: new UI text is a key, never a literal. `broker.dashboard.title`
    // already carries EN/IT/ES and is the same string the broker home page's
    // own nav landmark uses, so the two can never drift.
    messageKey: "broker.dashboard.title",
    requiresBrokerMembership: true,
  },
  {
    href: "/dashboard/staff/",
    label: "nav.moderation",
    permission: "approve_listings_and_revisions",
  },
  {
    href: "/dashboard/staff/settings/",
    label: "nav.settings",
    permission: "configure_products_and_settings",
  },
];

export default function PrimaryNav() {
  const { session, loading, can, logout } = useSession();
  const pathname = usePathname();
  const t = useT();
  const authenticated = session?.authenticated === true;

  const isBrokerMember = isBrokerAccount(session);
  // PrimaryNav is already a client component holding the session, so the
  // viewer's own locale is available here. resolveLocale is the shared helper
  // (lib/i18n/directory.ts:15) — the session's LocaleCode is "EN"/"IT"/"ES"
  // and the dictionary's Locale is "en"/"it"/"es", and that lowercasing lives
  // in exactly one place.
  const locale = useLocale();

  const visible = LINKS.filter((link) => {
    if (link.permission !== undefined && !can(link.permission)) return false;
    if (link.requiresBrokerMembership && !isBrokerMember) return false;
    // Brokers manage vessels under Fleet; the private-seller entries would only confuse them.
    if (link.requiresListingRight && (isBrokerMember || !can("create_private_listing"))) return false;
    return true;
  });

  // Below xl the links live behind a menu button instead of wrapping onto a second row.
  const [menuOpen, setMenuOpen] = useState(false);

  // Dashboards have their own left menu with a Home button; no site header there.
  if (pathname && splitLocalePath(pathname).path.startsWith("/dashboard")) return null;

  return (
    <nav
      aria-label={t("nav.aria")}
      className="sticky top-0 z-50 flex min-h-20 flex-wrap items-center gap-x-space-lg gap-y-space-xs py-space-xs bg-surface-container-lowest px-margin-mobile shadow-[0_1px_8px_rgba(0,0,0,0.04)] md:px-margin lg:px-margin-desktop"
    >
      <Link href="/" className="flex items-center">
        <span className="font-headline-sm text-2xl font-bold uppercase tracking-[0.15em] text-on-surface md:text-3xl">
          Nautelo
        </span>
      </Link>
      <button
        type="button"
        aria-expanded={menuOpen}
        aria-controls="primary-nav-links"
        onClick={() => setMenuOpen((open) => !open)}
        className="ml-auto inline-flex items-center gap-1 rounded-lg px-space-sm py-space-xs font-label-md text-primary hover:bg-surface-container xl:hidden"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[22px]">
          {menuOpen ? "close" : "menu"}
        </span>
        {t("nav.aria")}
      </button>
      <ul
        id="primary-nav-links"
        className={`${menuOpen ? "flex" : "hidden"} order-last w-full flex-col gap-y-space-xs xl:order-none xl:flex xl:w-auto xl:flex-1 xl:flex-row xl:flex-wrap xl:items-center xl:gap-x-space-lg`}
      >
        {visible.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center whitespace-nowrap py-space-xs font-body-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              {link.messageKey ? tConversations(locale, link.messageKey) : link.label ? t(link.label) : null}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex max-w-full flex-wrap items-center justify-end gap-x-space-md gap-y-space-xs xl:ml-auto">
        <LanguageSwitcher />
        {loading ? null : authenticated ? (
          <>
            <NotificationBell locale={locale} />
            <Link href={accountHrefFor(session?.user)} className="font-body-sm text-on-surface-variant hover:text-primary">
              {session?.user?.full_name || session?.user?.email}
            </Link>
            <button type="button" onClick={() => void logout()} className="font-label-md text-label-md text-primary">
              {t("nav.sign_out")}
            </button>
          </>
        ) : (
          <Link href="/login" className="font-body-md font-medium text-primary transition-colors hover:text-secondary">
            {t("nav.sign_in")}
          </Link>
        )}
        {isBrokerMember ? null : (
        <Link
          href="/sell/"
          className="inline-flex items-center justify-center rounded-lg bg-primary-container px-space-md py-space-sm font-body-md text-on-primary shadow-sm transition-colors hover:bg-primary"
        >
          {t("nav.list_boat")}
        </Link>
        )}
      </div>
    </nav>
  );
}

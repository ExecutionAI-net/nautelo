"use client";

import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useLocale } from "@/lib/i18n/useLocale";
import Link from "next/link";
import { usePathname } from "next/navigation";

import NotificationBell from "@/components/layout/NotificationBell";
import { useSession } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/auth/types";
import { tConversations } from "@/lib/i18n/conversations";
import { resolveLocale } from "@/lib/i18n/directory";

interface NavLink {
  href: string;
  /** Hard-coded English, as the six entries merged in Phase 3 all are. */
  label?: string;
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
  { href: "/boats/", label: "Buy" },
  { href: "/services/professionals/", label: "Services" },
  { href: "/brokers/", label: "Brokers" },
  { href: "/financing/", label: "Financing" },
  { href: "/guides/", label: "Guides" },
  { href: "/sell/", label: "Sell", permission: "create_private_listing" },
  { href: "/dashboard/private-seller/listings/", label: "My listings", requiresListingRight: true },
  { href: "/dashboard/broker/fleet/", label: "Fleet", permission: "create_broker_listing" },
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
    label: "Moderation",
    permission: "approve_listings_and_revisions",
  },
  {
    href: "/dashboard/staff/settings/",
    label: "Settings",
    permission: "configure_products_and_settings",
  },
];

export default function PrimaryNav() {
  const { session, loading, can, logout } = useSession();
  const pathname = usePathname();
  const authenticated = session?.authenticated === true;

  const isBrokerMember = (session?.broker_memberships?.length ?? 0) > 0;
  // PrimaryNav is already a client component holding the session, so the
  // viewer's own locale is available here. resolveLocale is the shared helper
  // (lib/i18n/directory.ts:15) — the session's LocaleCode is "EN"/"IT"/"ES"
  // and the dictionary's Locale is "en"/"it"/"es", and that lowercasing lives
  // in exactly one place.
  const locale = useLocale();

  const visible = LINKS.filter((link) => {
    if (link.permission !== undefined && !can(link.permission)) return false;
    if (link.requiresBrokerMembership && !isBrokerMember) return false;
    if (link.requiresListingRight && !(can("create_private_listing") || can("create_broker_listing"))) return false;
    return true;
  });

  // Dashboards have their own left menu with a Home button; no site header there.
  if (pathname?.startsWith("/dashboard")) return null;

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-50 flex min-h-20 flex-wrap items-center gap-x-space-lg gap-y-space-xs py-space-xs bg-surface-container-lowest px-margin-mobile shadow-[0_1px_8px_rgba(0,0,0,0.04)] md:px-margin lg:px-margin-desktop"
    >
      <Link href="/" className="font-title-lg text-title-lg uppercase tracking-tight text-primary">
        NAUTA
      </Link>
      <ul className="order-last flex w-full flex-wrap items-center gap-x-space-md xl:order-none xl:w-auto xl:flex-1 xl:gap-x-space-lg">
        {visible.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex items-center whitespace-nowrap py-space-xs font-body-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              {link.messageKey ? tConversations(locale, link.messageKey) : link.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-x-space-md gap-y-space-xs">
        <LanguageSwitcher />
        {loading ? null : authenticated ? (
          <>
            <NotificationBell locale={locale} />
            <Link href="/dashboard/private-seller/account/" className="font-body-sm text-on-surface-variant hover:text-primary">
              {session?.user?.full_name || session?.user?.email}
            </Link>
            <button type="button" onClick={() => void logout()} className="font-label-md text-label-md text-primary">
              Sign out
            </button>
          </>
        ) : (
          <Link href="/login" className="font-body-md font-medium text-primary transition-colors hover:text-secondary">
            Sign in
          </Link>
        )}
        <Link
          href="/sell/"
          className="inline-flex items-center justify-center rounded-lg bg-primary-container px-space-md py-space-sm font-body-md text-on-primary shadow-sm transition-colors hover:bg-primary"
        >
          List my boat
        </Link>
      </div>
    </nav>
  );
}

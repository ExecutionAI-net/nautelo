"use client";

import Link from "@/components/layout/LocaleLink";
import { usePathname } from "next/navigation";

import type { BrokerMembershipSummary, SessionPayload } from "@/lib/auth/types";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

interface BrokerNavLink {
  href: string;
  messageKey: string;
}

/** Spec 28 "Add": Navigation item `Messages` at /dashboard/broker/messages/.
 *
 * EXACTLY these two, and the test pins the array. Spec 4.2's broker row also
 * names /fleet/, /leads/, /team/, /profile/ and /subscription/ — none of those
 * pages exists, and spec 39 forbids shipping a control that leads nowhere
 * (PrimaryNav already holds the same line for /sell/ and /fleet/). Phases 16, 17
 * and 20 add their own entries when they add their own pages.
 *
 * Spec 28 "Remove" names a `Services & Surveyors` item. This repository never
 * had one — it belonged to the static prototype — so the removal is expressed
 * here as a pinned set that it cannot re-enter, plus the 301 in
 * next.config.ts. */
export const BROKER_NAV_LINKS: readonly BrokerNavLink[] = [
  { href: "/dashboard/broker/", messageKey: "broker.dashboard" },
  { href: "/dashboard/broker/messages/", messageKey: "broker.messages" },
];

/** The organization this dashboard is about.
 *
 * `broker_memberships` already contains only `is_active=True` rows
 * (accounts.selectors.get_broker_memberships), so the first entry is a live
 * membership. A person in two brokerages sees the first; an organization
 * switcher is not in spec 28's scope and is recorded in the plan's Known
 * Limitations rather than invented here. */
export function primaryBrokerMembership(
  session: SessionPayload | null,
): BrokerMembershipSummary | null {
  return session?.broker_memberships?.[0] ?? null;
}

export default function BrokerDashboardNav({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label={tConversations(locale, "broker.dashboard.title")}
      // The sidebar carries the same links on small screens; a second bar there was two stacked headers.
      className="hidden flex-wrap gap-space-md border-b border-outline-variant px-margin-mobile py-space-sm md:px-margin lg:flex"
    >
      {BROKER_NAV_LINKS.map((link) => {
        // startsWith, so a thread URL underneath Messages still marks Messages
        // as the current section. The dashboard root is matched exactly, or it
        // would claim every page below it.
        const current =
          link.href === "/dashboard/broker/"
            ? pathname === link.href
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={`font-label-md text-label-md ${
              current ? "text-primary underline" : "text-on-surface-variant"
            }`}
          >
            {tConversations(locale, link.messageKey)}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";

import { useSession } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/auth/types";

interface NavLink {
  href: string;
  label: string;
  permission?: PermissionKey;
}

// Public routes come from spec 4.1; the gated ones from spec 5's capability table.
const LINKS: NavLink[] = [
  { href: "/boats/", label: "Boats" },
  { href: "/brokers/", label: "Brokers" },
  { href: "/services/professionals/", label: "Services / Professionals" },
  { href: "/financing/", label: "Financing" },
  // NOTE: /sell/ (create_private_listing) and /fleet/ (create_broker_listing)
  // are deliberately ABSENT until Phase 11/16 build those pages. See the note below.
  {
    href: "/dashboard/staff/",
    label: "Moderation",
    permission: "approve_listings_and_revisions",
  },
  {
    href: "/settings/",
    label: "Settings",
    permission: "configure_products_and_settings",
  },
];

export default function PrimaryNav() {
  const { session, loading, can, logout } = useSession();
  const authenticated = session?.authenticated === true;

  const visible = LINKS.filter(
    (link) => link.permission === undefined || can(link.permission),
  );

  return (
    <nav
      aria-label="Primary"
      className="flex flex-wrap items-center gap-space-md border-b border-outline-variant bg-surface px-margin-mobile py-space-sm md:px-margin"
    >
      <Link href="/" className="font-title-lg text-title-lg text-primary">
        NAUTA
      </Link>
      <ul className="flex flex-wrap items-center gap-space-md">
        {visible.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="font-body-md text-on-surface-variant hover:text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="ml-auto flex items-center gap-space-sm">
        {loading ? null : authenticated ? (
          <>
            <Link
              href="/account/"
              className="font-body-sm text-on-surface-variant hover:text-primary"
            >
              {session?.user?.full_name || session?.user?.email}
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="font-label-md text-label-md text-primary"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="font-label-md text-label-md text-primary"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}

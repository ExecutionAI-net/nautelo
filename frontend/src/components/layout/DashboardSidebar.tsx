"use client";

import Link from "next/link";
import { useState } from "react";

import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import NotificationBell from "@/components/layout/NotificationBell";
import { useSession } from "@/lib/auth/session";
import { useLocale } from "@/lib/i18n/useLocale";

export type MenuGroup = { title: string; items: { href: string; label: string }[] };

/** Left menu of every dashboard: Home button, accordion groups, account actions. */
export default function DashboardSidebar({ eyebrow, groups, active }: { eyebrow: string; groups: MenuGroup[]; active: string }) {
  const { session, logout } = useSession();
  const locale = useLocale();
  const activeGroup = groups.find((group) => group.items.some((item) => item.href === active))?.title;
  const [open, setOpen] = useState<Record<string, boolean>>(() => (activeGroup ? { [activeGroup]: true } : { [groups[0]?.title ?? ""]: true }));
  const [mobileOpen, setMobileOpen] = useState(false);
  const name = session?.user?.full_name || session?.user?.email || "";

  return (
    <aside aria-label={`${eyebrow} menu`} className="w-full shrink-0 bg-surface-container-lowest shadow-sm lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-space-sm p-space-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-space-md py-space-xs font-label-md text-on-primary hover:bg-primary-container"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">home</span>
          Home
        </Link>
        <div className="flex items-center gap-space-sm">
          <NotificationBell locale={locale} />
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="dashboard-menu"
            onClick={() => setMobileOpen((state) => !state)}
            className="rounded-lg bg-surface-container px-space-sm py-space-xs font-label-md text-primary lg:hidden"
          >
            Menu
          </button>
        </div>
      </div>

      <div id="dashboard-menu" className={`${mobileOpen ? "block" : "hidden"} lg:block`}>
        <p className="px-space-md font-label-sm text-label-sm uppercase tracking-widest text-secondary">{eyebrow}</p>
        <nav aria-label={`${eyebrow} sections`} className="mt-space-xs px-space-sm pb-space-md">
          {groups.map((group) => {
            const expanded = open[group.title] === true;
            const panel = `menu-${group.title.replace(/\W+/g, "-").toLowerCase()}`;
            return (
              <div key={group.title} className="mb-space-xs">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panel}
                  onClick={() => setOpen((state) => ({ ...state, [group.title]: !expanded }))}
                  className="flex w-full items-center justify-between rounded-lg px-space-sm py-space-sm font-title-sm text-title-sm text-primary hover:bg-surface-container"
                >
                  {group.title}
                  <span aria-hidden="true" className={`transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
                </button>
                {expanded ? (
                  <ul id={panel} className="mt-1 flex flex-col gap-0.5 pl-space-sm">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={item.href === active ? "page" : undefined}
                          className={`block rounded-lg px-space-sm py-space-xs font-body-md ${
                            item.href === active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="flex flex-col gap-space-sm border-t border-outline-variant p-space-md">
          <LanguageSwitcher />
          {name ? <p className="truncate font-body-sm text-on-surface-variant">{name}</p> : null}
          <button type="button" onClick={() => void logout()} className="w-fit font-label-md text-primary underline">
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

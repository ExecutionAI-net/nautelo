"use client";

import Link from "@/components/layout/LocaleLink";
import { useEffect, useState } from "react";

import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import NotificationBell from "@/components/layout/NotificationBell";
import { SOURCE_TEXT, type MessageKey } from "@/i18n";
import { useT } from "@/i18n/client";
import { useSession } from "@/lib/auth/session";
import { useLocale } from "@/lib/i18n/useLocale";

export type MenuGroup = { title: string; items: { href: string; label: string }[] };

function dashKey(prefix: string, label: string): string {
  return `${prefix}${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;
}

/** Left menu of every dashboard: accordion groups, then the account block with the way back to the public site. */
export default function DashboardSidebar({
  eyebrow,
  groups,
  active,
  title,
  languageSwitcher = true,
}: {
  eyebrow: string;
  groups: MenuGroup[];
  active: string;
  title?: string;
  /** The staff screens are English-only, so the switcher is hidden there. */
  languageSwitcher?: boolean;
}) {
  const { session, logout } = useSession();
  const locale = useLocale();
  const t = useT();
  // AreaShell names tabs and groups in English; show them in the visitor's language when a key exists.
  const label = (prefix: string, text: string) => {
    const key = dashKey(prefix, text);
    return key in SOURCE_TEXT ? t(key as MessageKey) : text;
  };
  const areaLabel = label("nav.dash.area.", eyebrow);
  const activeLabel = groups.flatMap((group) => group.items).find((item) => item.href === active)?.label;
  // Every dashboard page shares one layout, so the tab title is set here: "My listings - Seller area - Nautelo".
  useEffect(() => {
    // Pages outside the menu (a revision review, a broker detail) name themselves through their heading.
    const heading = title ?? (activeLabel ? label("nav.dash.", activeLabel) : document.querySelector("main h1")?.textContent?.trim() ?? "");
    const parts = [heading, areaLabel, "Nautelo"].filter(Boolean);
    document.title = parts.join(" \u00b7 ");
  });
  const activeGroup = groups.find((group) => group.items.some((item) => item.href === active))?.title;
  const [open, setOpen] = useState<Record<string, boolean>>(() => (activeGroup ? { [activeGroup]: true } : { [groups[0]?.title ?? ""]: true }));
  const [mobileOpen, setMobileOpen] = useState(false);
  // A per-viewer convenience, so it lives in this browser only.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore on mount
      setCollapsed(window.localStorage.getItem("nauta_sidebar_collapsed") === "1");
    } catch {
      // storage blocked: stay expanded
    }
  }, []);
  function toggleCollapsed() {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem("nauta_sidebar_collapsed", value ? "0" : "1");
      } catch {
        // ignore
      }
      return !value;
    });
  }
  const name = session?.user?.full_name || session?.user?.email || "";

  return (
    <aside aria-label={t("nav.dash.menu", { area: areaLabel })} className={`w-full shrink-0 bg-surface-container-lowest shadow-sm lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto ${collapsed ? "lg:w-14" : "lg:w-72"}`}>
      <div className={`flex items-center justify-between gap-space-sm px-space-lg py-space-md ${collapsed ? "lg:flex-col lg:px-space-xs" : ""}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand menu" : "Collapse menu"}
          className="hidden rounded-lg p-1 text-primary hover:bg-surface-container lg:inline-flex"
        >
          <span className="material-symbols-outlined" aria-hidden="true">{collapsed ? "menu" : "menu_open"}</span>
        </button>
        {collapsed ? (
          <Link href="/" title={t("nav.dash.home")} className="hidden rounded-lg p-1 text-primary hover:bg-surface-container lg:inline-flex">
            <span className="material-symbols-outlined" aria-hidden="true">home</span>
            <span className="sr-only">{t("nav.dash.home")}</span>
          </Link>
        ) : (
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">{areaLabel}</span>
        )}
        <div className="flex items-center gap-space-sm">
          <NotificationBell locale={locale} align="left" />
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

      <div id="dashboard-menu" className={`${mobileOpen ? "block" : "hidden"} ${collapsed ? "lg:hidden" : "lg:block"}`}>
        <nav aria-label={t("nav.dash.sections", { area: areaLabel })} className="px-space-md pb-space-md">
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
                  className="flex w-full items-center justify-between rounded-lg px-space-sm py-space-xs font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant hover:bg-surface-container hover:text-primary"
                >
                  {label("nav.dash.group.", group.title)}
                  <span aria-hidden="true" className={`text-[10px] transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
                </button>
                {expanded ? (
                  <ul id={panel} className="mb-space-xs mt-0.5 flex flex-col gap-0.5">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={item.href === active ? "page" : undefined}
                          className={`block rounded-lg px-space-md py-space-xs font-body-md ${
                            item.href === active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                          }`}
                        >
                          {label("nav.dash.", item.label)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="flex flex-col gap-space-sm border-t border-outline-variant px-space-lg py-space-md">
          {languageSwitcher ? <LanguageSwitcher /> : null}
          {name ? <p className="truncate font-body-sm text-on-surface-variant">{name}</p> : null}
          <div className="flex flex-wrap items-center gap-space-md">
            <Link href="/" className="inline-flex items-center gap-1 font-label-md text-primary hover:underline">
              <span className="material-symbols-outlined text-base" aria-hidden="true">home</span>
              {t("nav.dash.home")}
            </Link>
            <button type="button" onClick={() => void logout()} className="w-fit font-label-md text-primary underline">
              {t("nav.sign_out")}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

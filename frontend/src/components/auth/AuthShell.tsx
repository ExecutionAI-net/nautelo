import Link from "@/components/layout/LocaleLink";

import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n";

type Tab = "login" | "register" | "recovery";

const TABS: { key: Tab; labelKey: MessageKey; href: string }[] = [
  { key: "login", labelKey: "auth.tab_login", href: "/login/" },
  { key: "register", labelKey: "auth.tab_register", href: "/register/" },
  { key: "recovery", labelKey: "auth.tab_recovery", href: "/forgot-password/" },
];

const POINTS: { titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { titleKey: "auth.point1_title", bodyKey: "auth.point1_body" },
  { titleKey: "auth.point2_title", bodyKey: "auth.point2_body" },
  { titleKey: "auth.point3_title", bodyKey: "auth.point3_body" },
];

export default function AuthShell({
  tab,
  heading,
  children,
}: {
  tab: Tab;
  heading: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <main className="w-full bg-surface">
      <header className="bg-surface-container-low py-space-xl">
        <div className="mx-auto max-w-[1440px] px-margin-mobile md:px-margin lg:px-margin-desktop">
          <span className="font-label-sm uppercase tracking-widest text-secondary">{t("auth.secure_account_access")}</span>
          <p className="mt-1 font-headline-lg text-headline-lg text-primary">{t("auth.nauta_account")}</p>
          <p className="mt-space-xs max-w-2xl font-body-md text-on-surface-variant">
            {t("auth.one_account_intro")}
          </p>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] gap-space-xl px-margin-mobile py-space-xl md:px-margin lg:grid-cols-[5fr_7fr] lg:px-margin-desktop">
        <aside className="hidden flex-col overflow-hidden rounded-xl bg-primary text-on-primary lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src="/design/c4967d98c7.jpg" className="h-64 w-full object-cover opacity-90" />
          <div className="flex flex-col gap-space-md p-space-lg">
            <span className="font-label-sm uppercase tracking-widest opacity-70">{t("auth.mediterranean_marketplace")}</span>
            {POINTS.map((point) => (
              <div key={point.titleKey}>
                <p className="font-title-md text-title-md">{t(point.titleKey)}</p>
                <p className="font-body-sm opacity-70">{t(point.bodyKey)}</p>
              </div>
            ))}
          </div>
        </aside>
        <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div className="mb-space-lg flex rounded-lg bg-surface-container p-1 font-label-md">
            {TABS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={item.key === tab ? "page" : undefined}
                className={`flex-1 rounded-md px-space-sm py-space-xs text-center transition-colors ${
                  item.key === tab ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </div>
          <h1 className="mb-space-md font-headline-md text-headline-md text-primary">{heading}</h1>
          {children}
        </section>
      </div>
    </main>
  );
}

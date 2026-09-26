"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useLocaleOrDefault } from "@/components/layout/LocaleContext";
import { businessAreaFor } from "@/lib/auth/home";
import { useSession } from "@/lib/auth/session";
import { localizePath, splitLocalePath } from "@/lib/i18n/localePath";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const AREAS = {
  broker: {
    home: "/dashboard/broker/",
    messages: "/dashboard/broker/messages/",
    account: "/dashboard/broker/account/",
    notifications: "/dashboard/broker/notifications/",
    listings: "/dashboard/broker/fleet/",
  },
  provider: {
    home: "/dashboard/service-provider/",
    messages: "/dashboard/service-provider/requests/",
    account: "/dashboard/service-provider/account/",
    notifications: "/dashboard/service-provider/notifications/",
    listings: "/dashboard/service-provider/",
  },
} as const;

/** Where a business account lands instead of a private seller page: the same thing in its own area. */
export function businessPathFor(path: string, area: keyof typeof AREAS = "broker"): string {
  const target = AREAS[area];
  const sellEdit = new RegExp(`^/sell/(${UUID})/?$`, "i").exec(path);
  if (sellEdit && area === "broker") return `/dashboard/broker/fleet/${sellEdit[1]}/`;
  const conversation = new RegExp(`^/dashboard/private-seller/messages/(${UUID})/?$`, "i").exec(path);
  if (conversation) return `${target.messages}${conversation[1]}/`;
  if (path.startsWith("/dashboard/private-seller/messages")) return target.messages;
  if (path.startsWith("/dashboard/private-seller/account")) return target.account;
  if (path.startsWith("/dashboard/private-seller/notifications")) return target.notifications;
  if (path.startsWith("/dashboard/private-seller/listings") || path.startsWith("/sell/")) return target.listings;
  return target.home;
}

/**
 * The private seller area is closed to business accounts: a broker or a
 * professional never sees it, never lists a boat as a private seller, and is
 * sent to the matching page of its own area instead.
 */
export default function PrivateAreaGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pageLocale = useLocaleOrDefault();
  const { session, loading } = useSession();
  const area = loading ? null : businessAreaFor(session);

  useEffect(() => {
    if (!area) return;
    router.replace(localizePath(businessPathFor(splitLocalePath(pathname ?? "/").path, area), pageLocale));
  }, [area, pathname, router, pageLocale]);

  return area ? null : <>{children}</>;
}

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useLocaleOrDefault } from "@/components/layout/LocaleContext";
import { isBrokerAccount } from "@/lib/auth/home";
import { useSession } from "@/lib/auth/session";
import { localizePath, splitLocalePath } from "@/lib/i18n/localePath";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Where a broker lands instead of a private seller page: the same thing in the brokerage area. */
export function brokerPathFor(path: string): string {
  const sellEdit = new RegExp(`^/sell/(${UUID})/?$`, "i").exec(path);
  if (sellEdit) return `/dashboard/broker/fleet/${sellEdit[1]}/`;
  const conversation = new RegExp(`^/dashboard/private-seller/messages/(${UUID})/?$`, "i").exec(path);
  if (conversation) return `/dashboard/broker/messages/${conversation[1]}/`;
  if (path.startsWith("/dashboard/private-seller/messages")) return "/dashboard/broker/messages/";
  if (path.startsWith("/dashboard/private-seller/account")) return "/dashboard/broker/account/";
  if (path.startsWith("/dashboard/private-seller/notifications")) return "/dashboard/broker/notifications/";
  if (path.startsWith("/dashboard/private-seller/listings") || path.startsWith("/sell/")) return "/dashboard/broker/fleet/";
  return "/dashboard/broker/";
}

/**
 * The private seller area is closed to broker accounts: a broker never sees
 * it, never lists a boat as a private seller, and is sent to the matching
 * brokerage page instead. Professionals still use parts of it (their inbox
 * lives under private-seller/messages), so only brokers are redirected.
 */
export default function PrivateAreaGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pageLocale = useLocaleOrDefault();
  const { session, loading } = useSession();
  const broker = !loading && isBrokerAccount(session);

  useEffect(() => {
    if (!broker) return;
    router.replace(localizePath(brokerPathFor(splitLocalePath(pathname ?? "/").path), pageLocale));
  }, [broker, pathname, router, pageLocale]);

  return broker ? null : <>{children}</>;
}

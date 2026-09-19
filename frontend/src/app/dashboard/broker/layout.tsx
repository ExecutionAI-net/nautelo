"use client";

import BrokerDashboardNav from "@/components/broker/BrokerDashboardNav";
import { useSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/directory";

/** The broker dashboard shell. The nav renders on every /dashboard/broker/ page
 * so spec 28's "Navigation item `Messages`" is present wherever a broker is,
 * not only on one screen. */
export default function BrokerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useSession();
  return (
    <>
      <BrokerDashboardNav locale={resolveLocale(session?.user?.locale)} />
      {children}
    </>
  );
}

"use client";

import SellListingForm from "@/components/listings/SellListingForm";
import { useSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/directory";

export default function SellListing() {
  const { session } = useSession();
  return <SellListingForm locale={resolveLocale(session?.user?.locale)} />;
}

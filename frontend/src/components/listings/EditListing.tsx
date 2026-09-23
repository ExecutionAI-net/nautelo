"use client";

import { useEffect, useState } from "react";

import { primaryBrokerMembership } from "@/components/broker/BrokerDashboardNav";
import SellListingForm from "@/components/listings/SellListingForm";
import { useSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/directory";
import { fetchWorkflowListing, type WorkflowListing } from "@/lib/api/sellerListings";

export default function EditListing({ listingId }: { listingId: string }) {
  const { session } = useSession();
  const [listing, setListing] = useState<WorkflowListing | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchWorkflowListing(listingId)
      .then((data) => {
        if (!cancelled) setListing(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (failed) return <p role="alert">This listing could not be opened.</p>;
  if (!listing) return <p className="text-on-surface-variant">Loading…</p>;
  // A brokerage vessel keeps its broker-only fields (financing estimate, fleet links) while being edited.
  const brokerId = listing.seller_type === "BROKER" ? primaryBrokerMembership(session)?.broker_id : undefined;
  return <SellListingForm initial={listing} brokerId={brokerId} locale={resolveLocale(session?.user?.locale)} />;
}

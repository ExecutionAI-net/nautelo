"use client";

import { useEffect, useState } from "react";

import SellListingForm from "@/components/listings/SellListingForm";
import { fetchWorkflowListing, type WorkflowListing } from "@/lib/api/sellerListings";

export default function EditListing({ listingId }: { listingId: string }) {
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
  return <SellListingForm initial={listing} />;
}

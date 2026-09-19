"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchConversations } from "@/lib/api/conversations";
import { fetchMyListings, type MyListingRow } from "@/lib/api/sellerListings";

export default function SellerOverview() {
  const [listings, setListings] = useState<MyListingRow[] | null>(null);
  const [conversations, setConversations] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchMyListings().then(setListings, () => setError(true));
    fetchConversations("ALL").then((page) => setConversations(page.count), () => setConversations(null));
  }, []);

  const count = (status: string) => listings?.filter((row) => row.status === status).length ?? 0;
  const cards = [
    { label: "Published", value: listings ? String(count("PUBLISHED")) : "-", href: "/dashboard/private-seller/listings/" },
    { label: "Drafts", value: listings ? String(count("DRAFT")) : "-", href: "/dashboard/private-seller/listings/" },
    { label: "In review", value: listings ? String(count("PENDING_APPROVAL")) : "-", href: "/dashboard/private-seller/listings/" },
    { label: "Conversations", value: conversations === null ? "-" : String(conversations), href: "/dashboard/private-seller/messages/" },
  ];

  return (
    <div className="flex flex-col gap-space-lg">
      <h1 className="font-headline-lg text-headline-lg text-primary">Overview</h1>
      {error ? <p role="alert">Your listings could not be loaded.</p> : null}
      <div className="grid gap-space-md sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm hover:shadow-md">
            <p className="font-label-sm uppercase text-on-surface-variant">{card.label}</p>
            <p className="mt-1 font-headline-md text-headline-md text-primary">{card.value}</p>
          </Link>
        ))}
      </div>
      <ul className="divide-y divide-outline-variant rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        {(listings ?? []).slice(0, 5).map((row) => (
          <li key={row.id} className="flex justify-between gap-space-sm py-space-sm">
            <span className="font-title-sm text-title-sm text-on-surface">{row.title}</span>
            <span className="font-body-sm text-on-surface-variant">{row.status}</span>
          </li>
        ))}
        {listings && listings.length === 0 ? (
          <li className="py-space-sm font-body-md text-on-surface-variant">
            No listings yet. <Link href="/sell/create/" className="text-primary underline">Create your first listing</Link>.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

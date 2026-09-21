"use client";

import Link from "@/components/layout/LocaleLink";
import { useEffect, useState } from "react";

import { ListingCard } from "@/components/listings/MyListings";
import { fetchConversations, type ConversationRow } from "@/lib/api/conversations";
import { useSession } from "@/lib/auth/session";
import { fetchMyListings, fetchMyListingsSummary, type MyListingRow, type MyListingsSummary } from "@/lib/api/sellerListings";

export default function SellerOverview() {
  const { session } = useSession();
  const [summary, setSummary] = useState<MyListingsSummary | null>(null);
  const [listings, setListings] = useState<MyListingRow[] | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[] | null>(null);
  const [conversationCount, setConversationCount] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchMyListingsSummary().then(setSummary, () => setError(true));
    fetchMyListings().then(setListings, () => setError(true));
    fetchConversations("ALL").then(
      (page) => {
        setConversationCount(page.count);
        setConversations(page.results.slice(0, 3));
      },
      () => setConversationCount(null),
    );
  }, []);

  const name = session?.user?.full_name || session?.user?.email || "";
  const cards = [
    { label: "Published", value: summary ? String(summary.published) : "-", href: "/dashboard/private-seller/listings/" },
    { label: "In review", value: summary ? String(summary.in_review) : "-", href: "/dashboard/private-seller/listings/" },
    { label: "Drafts", value: summary ? String(summary.drafts) : "-", href: "/dashboard/private-seller/listings/" },
    { label: "Total views", value: summary ? summary.views.toLocaleString("en") : "-", href: "/dashboard/private-seller/listings/" },
    { label: "Conversations", value: conversationCount === null ? "-" : String(conversationCount), href: "/dashboard/private-seller/messages/" },
  ];

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Owner portal</span>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">{name ? `Welcome back, ${name}` : "Welcome back"}</h1>
          <p className="mt-space-xs font-body-md text-on-surface-variant">Your listings, enquiries and account in one place.</p>
        </div>
        <Link href="/sell/create/" className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container">
          Create new listing
        </Link>
      </header>

      {error ? <p role="alert">Your listings could not be loaded.</p> : null}

      <div className="grid gap-space-md sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm hover:shadow-md">
            <p className="font-label-sm uppercase text-on-surface-variant">{card.label}</p>
            <p className="mt-1 font-headline-md text-headline-md text-primary">{card.value}</p>
          </Link>
        ))}
      </div>

      <section aria-labelledby="fleet-heading">
        <div className="flex items-center justify-between">
          <h2 id="fleet-heading" className="font-headline-sm text-headline-sm text-primary">My fleet &amp; listings</h2>
          <Link href="/dashboard/private-seller/listings/" className="font-label-md text-secondary hover:underline">
            View all
          </Link>
        </div>
        <ul className="mt-space-md flex flex-col gap-space-md">
          {(listings ?? []).slice(0, 3).map((row) => (
            <ListingCard key={row.id} row={row} />
          ))}
          {listings && listings.length === 0 ? (
            <li className="rounded-xl bg-surface-container-lowest p-space-lg font-body-md text-on-surface-variant shadow-sm">
              No listings yet. <Link href="/sell/create/" className="text-primary underline">Create your first listing</Link>.
            </li>
          ) : null}
        </ul>
      </section>

      <section aria-labelledby="inbox-heading" className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <div className="flex items-center justify-between">
          <h2 id="inbox-heading" className="font-headline-sm text-headline-sm text-primary">Inbound enquiries</h2>
          <Link href="/dashboard/private-seller/messages/" className="font-label-md text-secondary hover:underline">
            Open inbox
          </Link>
        </div>
        <ul className="mt-space-sm divide-y divide-outline-variant">
          {(conversations ?? []).map((row) => (
            <li key={row.id}>
              <Link href={`/dashboard/private-seller/messages/${row.id}/`} className="flex items-start justify-between gap-space-md py-space-sm hover:bg-surface-container-low">
                <span className="min-w-0">
                  <span className="block font-title-sm text-title-sm text-on-surface">{row.counterparty_name || row.subject}</span>
                  <span className="block truncate font-body-sm text-on-surface-variant">{row.last_message_excerpt || row.subject}</span>
                </span>
                {row.unread_count > 0 ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 font-label-sm text-on-primary">{row.unread_count}</span>
                ) : null}
              </Link>
            </li>
          ))}
          {conversations && conversations.length === 0 ? (
            <li className="py-space-sm font-body-md text-on-surface-variant">No enquiries yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

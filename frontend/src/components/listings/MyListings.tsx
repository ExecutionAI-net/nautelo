"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchMyListings, type MyListingRow } from "@/lib/api/sellerListings";

export default function MyListings() {
  const [rows, setRows] = useState<MyListingRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyListings()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1 className="font-headline-md text-headline-md text-primary">My listings</h1>
      {failed ? (
        <p role="alert" className="mt-space-md">
          Your listings could not be loaded.
        </p>
      ) : rows === null ? (
        <p className="mt-space-md text-on-surface-variant">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-space-md text-on-surface-variant">
          You have no listings yet. <Link href="/sell/create/" className="text-primary underline">Create one</Link>.
        </p>
      ) : (
        <ul className="mt-space-md flex flex-col gap-space-sm">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-outline-variant p-space-sm">
              <p className="font-title-sm text-title-sm">{row.title}</p>
              <p className="font-body-sm text-on-surface-variant">{row.status}</p>
              <div className="flex gap-space-md">
                <Link href={`/sell/${row.id}/`} className="text-primary underline">
                  Edit
                </Link>
                {row.slug && row.status === "PUBLISHED" ? (
                  <Link href={`/boats/${row.slug}/`} className="text-primary underline">
                    View
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

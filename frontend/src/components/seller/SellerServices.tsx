"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";

interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
}

const ICONS = ["engineering", "local_shipping", "gavel", "shield", "sailing", "handyman"];

export default function SellerServices() {
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    apiFetch<{ results?: Category[] } | Category[]>("/api/v1/service-categories/").then(
      (body) => setCategories(Array.isArray(body) ? body : (body.results ?? [])),
      () => setCategories([]),
    );
  }, []);

  return (
    <div className="flex flex-col gap-space-xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div>
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Owner console</span>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Nautical concierge &amp; services</h1>
          <p className="mt-space-xs font-body-md text-on-surface-variant">
            Find a verified professional to help you prepare, insure or transport your boat.
          </p>
        </div>
        <Link
          href="/services/professionals/"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">search</span>
          Browse the directory
        </Link>
      </div>

      <section aria-labelledby="book-heading" className="flex flex-col gap-space-md">
        <h2 id="book-heading" className="font-headline-sm text-headline-sm text-primary">Book nautical services for your fleet</h2>
        <div className="grid gap-space-md sm:grid-cols-2 lg:grid-cols-4">
          {(categories ?? []).map((category, index) => (
            <Link
              key={category.id}
              href={`/services/professionals/?category=${encodeURIComponent(category.slug)}`}
              className="group rounded-xl bg-surface-container-lowest p-space-lg shadow-sm hover:shadow-md transition-shadow flex flex-col gap-space-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-secondary-container/40 text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{ICONS[index % ICONS.length]}</span>
              </div>
              <p className="font-title-md text-title-md text-primary group-hover:text-secondary transition-colors">{category.name}</p>
              <p className="font-body-sm text-on-surface-variant">{category.description}</p>
              <span className="mt-auto inline-flex items-center gap-1 font-label-md text-secondary">
                Find providers
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">arrow_forward</span>
              </span>
            </Link>
          ))}
          {categories && categories.length === 0 ? (
            <p className="font-body-md text-on-surface-variant">
              No service categories are available right now. <Link href="/services/professionals/" className="text-primary underline">Browse the directory</Link>.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

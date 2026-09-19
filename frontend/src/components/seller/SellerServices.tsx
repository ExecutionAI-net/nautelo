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

export default function SellerServices() {
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    apiFetch<{ results?: Category[] } | Category[]>("/api/v1/service-categories/").then(
      (body) => setCategories(Array.isArray(body) ? body : (body.results ?? [])),
      () => setCategories([]),
    );
  }, []);

  return (
    <div className="flex flex-col gap-space-lg">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Services for sellers</h1>
        <p className="font-body-md text-on-surface-variant">
          Find a verified professional to help you prepare, insure or transport your boat.
        </p>
      </div>
      <div className="grid gap-space-md sm:grid-cols-2 lg:grid-cols-3">
        {(categories ?? []).map((category) => (
          <Link
            key={category.id}
            href={`/services/professionals/?category=${encodeURIComponent(category.slug)}`}
            className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm hover:shadow-md"
          >
            <p className="font-title-md text-title-md text-primary">{category.name}</p>
            <p className="mt-1 font-body-sm text-on-surface-variant">{category.description}</p>
          </Link>
        ))}
        {categories && categories.length === 0 ? (
          <p className="font-body-md text-on-surface-variant">
            No service categories are available right now. <Link href="/services/professionals/" className="text-primary underline">Browse the directory</Link>.
          </p>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

import { fetchPricingClient, formatPrice, type ListingPackage } from "@/lib/api/plans";
import { fetchProducts, updateProduct, type StaffProduct } from "@/lib/api/staffProducts";

const CODE_LABEL: Record<string, string> = {
  INDIVIDUAL_LISTING_RIGHT: "Individual listing right",
  LISTING_MEDIA_UPGRADE: "Listing media upgrade",
};

/** The packages a private seller can actually buy (payments.ListingPackage); their fields are edited in Django admin. */
function PackageList() {
  const [packages, setPackages] = useState<ListingPackage[] | null>(null);
  useEffect(() => {
    fetchPricingClient().then(
      (pricing) => setPackages(pricing.listing_packages ?? []),
      () => setPackages([]),
    );
  }, []);
  return (
    <section className="mt-space-xl">
      <h2 className="font-headline-sm text-headline-sm text-primary">Listing packages on sale</h2>
      <p className="mt-space-xs font-body-sm text-on-surface-variant">
        What private sellers see on the pricing page. Prices, durations and translations are edited in{" "}
        <a className="text-primary underline" href="/admin/payments/listingpackage/">
          Django admin
        </a>
        .
      </p>
      {packages === null ? (
        <p className="mt-space-sm text-on-surface-variant">Loading…</p>
      ) : packages.length === 0 ? (
        <p className="mt-space-sm text-on-surface-variant">No active package.</p>
      ) : (
        <ul className="mt-space-sm flex flex-col gap-space-xs">
          {packages.map((pkg) => (
            <li key={pkg.slug} className="flex flex-wrap items-center justify-between gap-space-sm rounded-lg border border-outline-variant p-space-sm font-body-md">
              <span>
                {pkg.name} · {pkg.publication_days} days · {pkg.image_limit} photos
                {pkg.video_limit ? ` + ${pkg.video_limit} video` : ""}
              </span>
              <span className="font-label-md font-semibold">{formatPrice(pkg.amount, pkg.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProductCard({ product, onSaved }: { product: StaffProduct; onSaved: () => void }) {
  const [name, setName] = useState(product.name_en);
  const [productId, setProductId] = useState(product.stripe_product_id);
  const [priceId, setPriceId] = useState(product.stripe_price_id);
  const [active, setActive] = useState(product.is_active);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await updateProduct(product.id, {
        name_en: name,
        stripe_product_id: productId,
        stripe_price_id: priceId,
        is_active: active,
      });
      setMessage("Saved.");
      onSaved();
    } catch {
      setMessage("Not saved. An active product needs a Stripe price that matches its display amount.");
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-space-sm rounded-lg border border-outline-variant p-space-md">
      <h2 className="font-title-md text-title-md">
        {CODE_LABEL[product.code] ?? product.code} · {product.display_amount} {product.currency}
      </h2>
      <p className="font-body-sm text-on-surface-variant">
        Stripe price check: {product.price_state.toLowerCase().replace(/_/g, " ")} (an active product needs a Stripe price that matches its display amount)
      </p>
      <label className="font-body-md">
        Name (EN)
        <input className="ml-space-xs rounded border border-outline-variant p-space-xs" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="font-body-md">
        Stripe product id
        <input className="ml-space-xs rounded border border-outline-variant p-space-xs" value={productId} onChange={(e) => setProductId(e.target.value)} />
      </label>
      <label className="font-body-md">
        Stripe price id
        <input className="ml-space-xs rounded border border-outline-variant p-space-xs" value={priceId} onChange={(e) => setPriceId(e.target.value)} />
      </label>
      <label className="font-body-md">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
      </label>
      <button type="submit" className="self-start">
        Save
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}

export default function ProductSettings() {
  const [products, setProducts] = useState<StaffProduct[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchProducts()
      .then((rows) => {
        if (!cancelled) setProducts(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <section>
      <h1 className="font-headline-md text-headline-md text-primary">Products</h1>
      {failed ? (
        <p role="alert">The products could not be loaded.</p>
      ) : products === null ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : (
        <div className="mt-space-md flex flex-col gap-space-md">
          {products.map((product) => (
            <ProductCard key={`${product.id}-${product.stripe_price_id}`} product={product} onSaved={() => setTick((n) => n + 1)} />
          ))}
        </div>
      )}
      <PackageList />
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

import { fetchProducts, updateProduct, type StaffProduct } from "@/lib/api/staffProducts";

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
        {product.code} · {product.display_amount} {product.currency}
      </h2>
      <p className="font-body-sm text-on-surface-variant">Price check: {product.price_state}</p>
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
    </section>
  );
}

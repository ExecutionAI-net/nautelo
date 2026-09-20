import type { Metadata } from "next";
import Link from "next/link";

import PlanCards from "@/components/pricing/PlanCards";
import { formatPrice } from "@/lib/api/plans";
import { fetchPricing } from "@/lib/api/plansServer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Membership tiers for brokerages and the listing right for individual sellers on NAUTA.",
  alternates: { canonical: "/pricing/" },
};

export default async function PricingPage() {
  const { broker_plans: plans, individual_products: products } = await fetchPricing();
  return (
    <main className="w-full bg-surface">
      <section className="w-full bg-surface-container-low py-space-xl">
        <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
          <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">Pricing</span>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Plans for every seller</h1>
          <p className="mt-space-xs max-w-3xl font-body-lg text-body-lg text-on-surface-variant">
            Brokerages choose a membership tier. Individual owners pay once for a listing right.
          </p>
        </div>
      </section>
      <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-2xl">
        <section aria-labelledby="brokers-heading" className="flex flex-col gap-space-lg">
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">For brokerages</span>
            <h2 id="brokers-heading" className="font-headline-md text-headline-md text-primary">Scalable Membership Tiers</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Tiers differ by active listings, team seats and how your profile is placed in the directory.
            </p>
          </div>
          {plans.length > 0 ? (
            <PlanCards plans={plans} />
          ) : (
            <p className="font-body-md text-on-surface-variant">Membership tiers will be published soon.</p>
          )}
        </section>

        <section aria-labelledby="individuals-heading" className="flex flex-col gap-space-lg">
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">For individual sellers</span>
            <h2 id="individuals-heading" className="font-headline-md text-headline-md text-primary">Sell your boat</h2>
          </div>
          {products.length > 0 ? (
            <div className="grid grid-cols-1 gap-space-lg md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <div key={product.code} className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between gap-space-xl">
                  <div className="flex flex-col gap-space-md">
                    <h3 className="font-headline-sm text-headline-sm text-primary">{product.name}</h3>
                    {product.description ? <p className="font-body-sm text-body-sm text-on-surface-variant">{product.description}</p> : null}
                    <div className="flex items-baseline gap-1 py-space-xs">
                      <span className="font-headline-lg text-headline-lg text-primary">{formatPrice(product.amount, product.currency)}</span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">one-off</span>
                    </div>
                    <ul className="flex flex-col gap-space-sm text-body-md text-on-surface">
                      <li className="flex items-center gap-space-sm">
                        <span className="material-symbols-outlined text-secondary text-[18px]" aria-hidden="true">check</span>
                        <span>One listing published on NAUTA</span>
                      </li>
                      {product.publication_days ? (
                        <li className="flex items-center gap-space-sm">
                          <span className="material-symbols-outlined text-secondary text-[18px]" aria-hidden="true">check</span>
                          <span>Live for {product.publication_days} days</span>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                  <Link href="/sell/create/" className="w-full bg-primary text-on-primary hover:bg-primary-container font-body-md py-space-sm px-space-md rounded text-center transition-colors">
                    Start a listing
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-body-md text-on-surface-variant">
              Your first listing is included with a new seller account. Paid listing rights will appear here.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

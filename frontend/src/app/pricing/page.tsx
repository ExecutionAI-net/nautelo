import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";

import PlanCards from "@/components/pricing/PlanCards";
import { formatPrice } from "@/lib/api/plans";
import { getT } from "@/i18n/server";
import { fetchPricing } from "@/lib/api/plansServer";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("pricing.page.meta_title"), description: t("pricing.page.meta_description") };
}

export default async function PricingPage() {
  const t = await getT();
  const { broker_plans: plans, individual_products: products, listing_packages: packages = [], professional_plan: professional } = await fetchPricing();
  return (
    <main className="w-full bg-surface">
      <section className="w-full bg-surface-container-low py-space-xl">
        <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
          <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">{t("pricing.page.pricing")}</span>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">{t("pricing.page.plans_for_brokerages_professionals_and_private")}</h1>
          <p className="mt-space-xs max-w-3xl font-body-lg text-body-lg text-on-surface-variant">
            {t("pricing.page.brokerages_choose_a_membership_tier_service")}
          </p>
        </div>
      </section>
      <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-2xl">
        <section aria-labelledby="brokers-heading" className="flex flex-col gap-space-lg">
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">{t("pricing.page.for_brokerages")}</span>
            <h2 id="brokers-heading" className="font-headline-md text-headline-md text-primary">{t("pricing.page.membership_tiers")}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t("pricing.page.tiers_differ_by_active_listings_team")}
            </p>
          </div>
          {plans.length > 0 ? (
            <PlanCards plans={plans} ctaHref="/register/broker/" ctaLabel={t("pricing.page.start_free_trial")} />
          ) : (
            <p className="font-body-md text-on-surface-variant">{t("pricing.page.membership_tiers_will_be_published_soon")}</p>
          )}
        </section>

        <section aria-labelledby="professionals-heading" className="flex flex-col gap-space-lg">
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">{t("pricing.page.for_service_professionals")}</span>
            <h2 id="professionals-heading" className="font-headline-md text-headline-md text-primary">{t("pricing.page.get_listed_in_the_directory")}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t("pricing.page.surveyors_insurers_transport_legal_and_other")}
            </p>
          </div>
          {professional ? (
            <div className="max-w-md bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col gap-space-md">
              <h3 className="font-headline-sm text-headline-sm text-primary">{professional.name}</h3>
              {professional.tagline ? <p className="font-body-sm text-body-sm text-on-surface-variant">{professional.tagline}</p> : null}
              <div className="flex items-baseline gap-1">
                <span className="font-headline-lg text-headline-lg text-primary">{formatPrice(professional.monthly_price, professional.currency)}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">{t("pricing.page.month")}</span>
              </div>
              <Link href="/dashboard/service-provider/membership/" className="w-full bg-primary text-on-primary hover:bg-primary-container font-body-md py-space-sm px-space-md rounded text-center transition-colors">
                {t("pricing.page.get_listed")}
              </Link>
            </div>
          ) : (
            <p className="font-body-md text-on-surface-variant">{t("pricing.page.professional_membership_will_open_soon")}</p>
          )}
        </section>

        <section aria-labelledby="individuals-heading" className="flex flex-col gap-space-lg">
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">{t("pricing.page.for_individual_sellers")}</span>
            <h2 id="individuals-heading" className="font-headline-md text-headline-md text-primary">{t("pricing.page.sell_your_boat")}</h2>
          </div>
          {packages.length > 0 ? (
            <div className="grid grid-cols-1 gap-space-lg md:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <div key={pkg.slug} className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between gap-space-xl">
                  <div className="flex flex-col gap-space-md">
                    <h3 className="font-headline-sm text-headline-sm text-primary">{pkg.name}</h3>
                    {pkg.description ? <p className="font-body-sm text-body-sm text-on-surface-variant">{pkg.description}</p> : null}
                    <div className="flex items-baseline gap-1 py-space-xs">
                      <span className="font-headline-lg text-headline-lg text-primary">{formatPrice(pkg.amount, pkg.currency)}</span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">{t("pricing.page.per_listing_one_off")}</span>
                    </div>
                    <ul className="flex flex-col gap-space-sm text-body-md text-on-surface">
                      <li className="flex items-center gap-space-sm">
                        <span className="material-symbols-outlined text-secondary text-[18px]" aria-hidden="true">check</span>
                        <span>{t("pricing.page.online_for_days", { days: pkg.publication_days })}</span>
                      </li>
                      <li className="flex items-center gap-space-sm">
                        <span className="material-symbols-outlined text-secondary text-[18px]" aria-hidden="true">check</span>
                        <span>
                          {t("pricing.page.up_to_photos", { count: pkg.image_limit })}
                          {pkg.video_limit ? ` ${t("pricing.page.and_video", { count: pkg.video_limit })}` : ""}
                        </span>
                      </li>
                      <li className="flex items-center gap-space-sm">
                        <span className="material-symbols-outlined text-secondary text-[18px]" aria-hidden="true">check</span>
                        <span>{t("pricing.page.buy_several_extend_or_re_activate")}</span>
                      </li>
                    </ul>
                  </div>
                  <Link href={`/sell/create/?package=${encodeURIComponent(pkg.slug)}`} className="w-full bg-primary text-on-primary hover:bg-primary-container font-body-md py-space-sm px-space-md rounded text-center transition-colors">
                    {t("pricing.page.start_a_listing")}
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-body-md text-on-surface-variant">
              {t("pricing.page.your_first_listing_is_included_with")}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

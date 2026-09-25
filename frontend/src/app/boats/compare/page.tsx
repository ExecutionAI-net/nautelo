import type { Metadata } from "next";

import { getT } from "@/i18n/server";
import Link from "@/components/layout/LocaleLink";
import { readableSpecs } from "@/components/listings/BoatDetailView";
import { askingPrice } from "@/components/listings/money";
import { fetchPublishedListing, listingPath, type PublicListing } from "@/lib/api/listings";
import { COMPARE_MAX, comparePath, parseCompareIds } from "@/lib/compare";
import { placeLabel } from "@/lib/i18n/places";
import { getRequestLocale } from "@/lib/i18n/requestLocale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("boats.compare.meta_title"), robots: { index: false } };
}

interface Row {
  key: string;
  label: string;
  values: string[];
  differs: boolean;
}

/** `/boats/compare/?ids=a,b,c` - up to COMPARE_MAX published listings side by side. Every cell is API data. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [t, locale, params] = await Promise.all([getT(), getRequestLocale(), searchParams]);
  const ids = parseCompareIds(params.ids);
  const fetched = await Promise.all(ids.map((id) => fetchPublishedListing(id)));
  const listings = fetched.filter((item): item is PublicListing => item !== null);

  const specRows = listings.map((listing) => readableSpecs(listing.specifications, t));
  const order: { key: string; label: string }[] = [];
  for (const rows of specRows) {
    for (const row of rows) if (!order.some((item) => item.key === row.key)) order.push({ key: row.key, label: row.label });
  }
  const missing = t("boats.compare.not_specified");
  const rows: Row[] = [
    {
      key: "price",
      label: t("boats.compare.price"),
      values: listings.map((listing) => askingPrice(locale, listing.price.amount, listing.price.currency) ?? missing),
    },
    { key: "year", label: t("boats.compare.year"), values: listings.map((listing) => String(listing.manufacture_year)) },
    { key: "location", label: t("boats.compare.location"), values: listings.map((listing) => placeLabel(listing.location) || missing) },
    {
      key: "seller",
      label: t("boats.compare.seller"),
      values: listings.map((listing) =>
        listing.seller_type === "BROKER" ? listing.broker?.name || t("boats.compare.professional_seller") : t("boats.compare.private_seller"),
      ),
    },
    ...order.map(({ key, label }) => ({
      key,
      label,
      values: specRows.map((specs) => specs.find((row) => row.key === key)?.value ?? missing),
    })),
  ].map((row) => ({ ...row, differs: new Set(row.values).size > 1 }));

  return (
    <main className="w-full bg-surface">
      <section className="w-full bg-surface-container-low pb-space-lg pt-space-xl">
        <div className="mx-auto max-w-[1440px] px-margin-mobile md:px-margin lg:px-margin-desktop">
          <nav className="mb-space-xs flex items-center gap-space-xs font-label-md uppercase tracking-wider text-on-surface-variant">
            <Link href="/boats/" className="transition-colors hover:text-primary">
              {t("boats.title")}
            </Link>
            <span className="text-outline-variant">/</span>
            <span className="font-semibold text-primary">{t("boats.compare.title")}</span>
          </nav>
          <div className="flex flex-wrap items-baseline gap-space-md">
            <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">{t("boats.compare.title")}</h1>
            {listings.length ? (
              <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 font-label-md text-on-surface-variant">
                {t("boats.compare.count", { count: listings.length })}
              </span>
            ) : null}
          </div>
          <p className="mt-space-xs max-w-2xl font-body-md text-on-surface-variant">{t("boats.compare.intro")}</p>
        </div>
      </section>

      <section className="w-full pb-space-2xl pt-space-lg">
        <div className="mx-auto max-w-[1440px] px-margin-mobile md:px-margin lg:px-margin-desktop">
          {listings.length === 0 ? (
            <div className="rounded-xl bg-surface-container-lowest p-space-lg text-center shadow-sm">
              <h2 className="font-headline-sm text-headline-sm text-primary">{t("boats.compare.empty_title")}</h2>
              <p className="mt-space-xs font-body-md text-on-surface-variant">{t("boats.compare.empty_text", { max: COMPARE_MAX })}</p>
              <Link
                href="/boats/"
                className="mt-space-md inline-flex rounded bg-primary-container px-space-md py-2 font-body-sm font-medium text-on-primary shadow-sm hover:bg-primary"
              >
                {t("boats.compare.browse")}
              </Link>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left">
                <caption className="sr-only">{t("boats.compare.title")}</caption>
                <thead>
                  <tr className="align-top">
                    <th scope="col" className="w-48 pb-space-md pr-space-md font-label-sm uppercase tracking-widest text-secondary">
                      {t("boats.compare.spec")}
                    </th>
                    {listings.map((listing) => {
                      const modelName = listing.custom_model_name || listing.model_name;
                      const heading = `${listing.manufacture_year} ${listing.brand_name} ${modelName}`;
                      const image = listing.media.find((item) => item.media_type === "IMAGE" && item.url);
                      const href = listingPath(listing);
                      const others = listings.filter((item) => item.id !== listing.id).map((item) => item.id);
                      return (
                        <th key={listing.id} scope="col" className="pb-space-md pr-space-sm font-normal">
                          <div className="flex h-full flex-col rounded-xl bg-surface-container-lowest p-space-sm shadow-sm">
                            <div className="mb-space-sm aspect-[16/10] w-full overflow-hidden rounded-lg bg-surface-container-high">
                              {image ? (
                                // eslint-disable-next-line @next/next/no-img-element -- CDN URL
                                <img src={image.url ?? ""} alt={heading} className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <span className="font-label-sm uppercase tracking-wider text-secondary">{listing.brand_name}</span>
                            <span className="font-headline-sm text-headline-sm leading-tight text-primary">{listing.title[locale] || heading}</span>
                            <div className="mt-space-sm flex flex-col gap-space-xs">
                              {href ? (
                                <Link
                                  href={href}
                                  className="rounded bg-primary-container px-space-md py-2 text-center font-body-sm font-medium text-on-primary shadow-sm hover:bg-primary"
                                >
                                  {t("boats.compare.view_listing")}
                                </Link>
                              ) : null}
                              <Link href={comparePath(others)} className="py-1 text-center font-label-md text-on-surface-variant hover:text-error">
                                {t("boats.compare.remove")}
                              </Link>
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className={row.differs ? "bg-surface-container-low" : ""}>
                      <th scope="row" className="border-t border-outline-variant py-space-sm pr-space-md font-label-md text-on-surface-variant">
                        {row.label}
                      </th>
                      {row.values.map((value, index) => (
                        <td key={listings[index].id} className="border-t border-outline-variant py-space-sm pr-space-sm font-body-md text-primary">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-space-sm font-body-sm text-on-surface-variant">{t("boats.compare.differences_note")}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

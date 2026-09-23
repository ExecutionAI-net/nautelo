// Server-side public read (imports next/headers through directoryFetch; never import from a client component).
import { directoryFetch } from "@/lib/api/directory";
import type { Pricing } from "@/lib/api/plans";
import { getRequestLocale } from "@/lib/i18n/requestLocale";

/** Server components. Names come back in the page's language. A pricing outage renders an empty section rather than an error. */
export async function fetchPricing(): Promise<Pricing> {
  try {
    const locale = await getRequestLocale();
    return (await directoryFetch<Pricing>(`/api/v1/pricing/?locale=${locale}`)) ?? { broker_plans: [], individual_products: [] };
  } catch {
    return { broker_plans: [], individual_products: [] };
  }
}

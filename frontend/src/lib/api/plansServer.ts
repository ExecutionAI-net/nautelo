// Server-side public read (imports next/headers through directoryFetch; never import from a client component).
import { directoryFetch } from "@/lib/api/directory";
import type { Pricing } from "@/lib/api/plans";

/** Server components. A pricing outage renders an empty section rather than an error. */
export async function fetchPricing(): Promise<Pricing> {
  try {
    return (await directoryFetch<Pricing>("/api/v1/pricing/")) ?? { broker_plans: [], individual_products: [] };
  } catch {
    return { broker_plans: [], individual_products: [] };
  }
}

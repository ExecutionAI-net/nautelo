import type { Metadata } from "next";

import PageBand from "@/components/layout/PageBand";
import ValuationForm from "@/components/valuation/ValuationForm";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("sell.valuation.meta_title"),
    description: t("sell.valuation.meta_description"),
  };
}

const STEPS: [MessageKey, MessageKey][] = [
  ["sell.valuation.step1_title", "sell.valuation.step1_text"],
  ["sell.valuation.step2_title", "sell.valuation.step2_text"],
  ["sell.valuation.step3_title", "sell.valuation.step3_text"],
];

export default async function ValuationPage() {
  const t = await getT();
  return (
    <main className="w-full bg-surface">
      <PageBand eyebrow={t("sell.valuation.eyebrow")} title={t("sell.valuation.title")} subtitle={t("sell.valuation.subtitle")} />
      <section className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin lg:px-margin-desktop">
        <ValuationForm />
        <ol className="mx-auto mt-space-2xl grid max-w-4xl gap-space-lg md:grid-cols-3">
          {STEPS.map(([titleKey, textKey], i) => (
            <li key={titleKey} className="rounded-xl bg-surface-container-lowest p-space-md">
              <span className="font-label-md text-secondary">{t("sell.valuation.step_label", { number: i + 1 })}</span>
              <h2 className="font-title-md">{t(titleKey)}</h2>
              <p className="font-body-sm text-on-surface-variant">{t(textKey)}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

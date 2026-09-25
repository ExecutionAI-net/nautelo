import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";

import PageBand from "@/components/layout/PageBand";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("for_brokers.meta_title"), description: t("for_brokers.meta_description") };
}

const BENEFITS: [MessageKey, MessageKey][] = [
  ["for_brokers.benefit1_title", "for_brokers.benefit1_text"],
  ["for_brokers.benefit2_title", "for_brokers.benefit2_text"],
  ["for_brokers.benefit3_title", "for_brokers.benefit3_text"],
  ["for_brokers.benefit4_title", "for_brokers.benefit4_text"],
  ["for_brokers.benefit5_title", "for_brokers.benefit5_text"],
  ["for_brokers.benefit6_title", "for_brokers.benefit6_text"],
];

const FAQ: [MessageKey, MessageKey][] = [
  ["for_brokers.faq1_q", "for_brokers.faq1_a"],
  ["for_brokers.faq2_q", "for_brokers.faq2_a"],
  ["for_brokers.faq3_q", "for_brokers.faq3_a"],
  ["for_brokers.faq4_q", "for_brokers.faq4_a"],
];

export default async function ForBrokersPage() {
  const t = await getT();
  return (
    <main className="w-full bg-surface">
      <PageBand eyebrow={t("for_brokers.eyebrow")} title={t("for_brokers.title")} subtitle={t("for_brokers.subtitle")} />
      <section className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin lg:px-margin-desktop">
        <div className="flex flex-wrap gap-space-sm">
          <Link href="/register/broker/" className="rounded-lg bg-primary px-space-lg py-space-sm font-label-md text-on-primary">{t("for_brokers.open_account")}</Link>
          <Link href="/pricing/" className="rounded-lg bg-surface-container-low px-space-lg py-space-sm font-label-md">{t("for_brokers.see_pricing")}</Link>
        </div>
        <ul className="mt-space-xl grid gap-space-md md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(([titleKey, textKey]) => (
            <li key={titleKey} className="rounded-xl bg-surface-container-lowest p-space-md">
              <h2 className="font-title-md">{t(titleKey)}</h2>
              <p className="font-body-sm text-on-surface-variant">{t(textKey)}</p>
            </li>
          ))}
        </ul>
        <h2 className="mt-space-2xl font-headline-sm">{t("for_brokers.questions")}</h2>
        <dl className="mt-space-md grid max-w-3xl gap-space-md">
          {FAQ.map(([qKey, aKey]) => (
            <div key={qKey}>
              <dt className="font-title-md">{t(qKey)}</dt>
              <dd className="font-body-md text-on-surface-variant">{t(aKey)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-space-xl font-body-md">
          {t("for_brokers.questions_before_you_start")} <Link className="text-secondary underline" href="/contact/">{t("for_brokers.contact_us")}</Link>.
        </p>
      </section>
    </main>
  );
}

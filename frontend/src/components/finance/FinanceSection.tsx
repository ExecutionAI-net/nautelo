"use client";

import { useT } from "@/i18n/client";
import Link from "@/components/layout/LocaleLink";
import FinanceSimulator from "@/components/finance/FinanceSimulator";

const STATS = [
  ["home.finance.stat1_value", "home.finance.stat1_label"],
  ["home.finance.stat2_value", "home.finance.stat2_label"],
  ["home.finance.stat3_value", "home.finance.stat3_label"],
] as const;

const FEATURES = [
  ["account_balance", "home.finance.feat1_title", "home.finance.feat1_text"],
  ["calculate", "home.finance.feat2_title", "home.finance.feat2_text"],
  ["verified", "home.finance.feat3_title", "home.finance.feat3_text"],
] as const;

/** Home page band: the marine financing pitch on the left, the real estimator on the right. */
export default function FinanceSection() {
  const t = useT();
  return (
    <section aria-labelledby="finance-heading" className="w-full border-b border-outline-variant bg-surface py-space-2xl">
      <div className="mx-auto grid max-w-[1440px] items-start gap-space-xl px-margin-mobile md:px-margin lg:grid-cols-12 lg:px-margin-desktop">
        <div className="flex flex-col lg:col-span-7 lg:pr-space-md">
          <span className="flex items-center gap-space-xs font-label-sm uppercase tracking-widest text-secondary">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-secondary" />
            {t("home.finance.eyebrow")}
          </span>
          <h2 id="finance-heading" className="mt-space-sm font-headline-lg text-headline-lg text-primary tracking-tight">{t("home.finance.title")}</h2>
          <p className="mb-space-lg mt-space-sm max-w-2xl font-body-lg text-on-surface-variant">{t("home.finance.intro")}</p>

          <div className="mb-space-lg grid grid-cols-1 gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-space-md sm:grid-cols-3">
            {STATS.map(([valueKey, labelKey], index) => (
              <div key={valueKey} className={`flex flex-col ${index > 0 ? "border-t pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0 border-outline-variant" : ""}`}>
                <span className="font-spec-num text-xl font-bold text-primary">{t(valueKey)}</span>
                <span className="font-label-sm text-body-sm text-on-surface-variant">{t(labelKey)}</span>
              </div>
            ))}
          </div>

          <div className="mb-space-lg grid grid-cols-1 gap-space-sm">
            {FEATURES.map(([icon, titleKey, textKey]) => (
              <div key={titleKey} className="flex items-start gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low text-secondary">
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">{icon}</span>
                </div>
                <div>
                  <h3 className="mb-1 font-title-md text-title-md font-semibold text-primary">{t(titleKey)}</h3>
                  <p className="font-body-sm text-on-surface-variant">{t(textKey)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-space-sm flex flex-wrap items-center gap-space-md">
            <Link href="/financing/" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-space-lg py-2.5 font-title-md text-title-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-container">
              {t("home.finance.cta_primary")}
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
            <Link href="/financing/#comparison" className="font-title-md text-body-md font-semibold text-secondary transition-colors hover:text-primary">
              {t("home.finance.cta_secondary")} →
            </Link>
          </div>
          <p className="mt-2 font-body-sm text-xs leading-relaxed text-outline">{t("home.finance.disclaimer")}</p>
        </div>

        <div className="lg:col-span-5 lg:w-full">
          <FinanceSimulator compact />
        </div>
      </div>
    </section>
  );
}

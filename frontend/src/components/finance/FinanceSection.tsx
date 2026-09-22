"use client";

import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n";
import FinanceSimulator from "@/components/finance/FinanceSimulator";
import { useLocale } from "@/lib/i18n/useLocale";

/** Home page band: a short pitch on the left, the simulator on the right. */
export default function FinanceSection() {
  const t = useT();
  const locale = useLocale();
  return (
    <section aria-labelledby="finance-heading" className="w-full bg-surface-container-low py-space-2xl">
      <div className="mx-auto grid max-w-[1440px] items-center gap-space-xl px-margin-mobile md:px-margin lg:grid-cols-12 lg:px-margin-desktop">
        <div className="lg:col-span-5">
          <span className="font-label-sm uppercase tracking-widest text-secondary">{t("sim.eyebrow")}</span>
          <h2 id="finance-heading" className="mt-1 font-headline-lg text-primary">{t("sim.title")}</h2>
          <p className="mt-space-sm max-w-md font-body-md text-on-surface-variant">{t("sim.lead")}</p>
          <ul className="mt-space-md grid gap-space-xs font-body-md text-on-surface-variant">
            {["sim.point1", "sim.point2", "sim.point3"].map((key) => (
              <li key={key} className="flex gap-space-xs">
                <span aria-hidden="true" className="text-secondary">✓</span>
                {t(key as MessageKey)}
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-7 lg:justify-self-end lg:w-full lg:max-w-xl">
          <FinanceSimulator compact />
        </div>
      </div>
    </section>
  );
}

import ContactRequestForm, { type StudyStart } from "@/components/contact/ContactRequestForm";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n";
const DOCUMENT_KEYS: MessageKey[] = [
  "finance.documents.item1",
  "finance.documents.item2",
  "finance.documents.item3",
  "finance.documents.item4",
];

const STEP_KEYS: [MessageKey, MessageKey][] = [
  ["finance.step1.title", "finance.step1.text"],
  ["finance.step2.title", "finance.step2.text"],
  ["finance.step3.title", "finance.step3.text"],
];

const FAQ_KEYS: [MessageKey, MessageKey][] = [
  ["finance.faq.q1", "finance.faq.a1"],
  ["finance.faq.q2", "finance.faq.a2"],
  ["finance.faq.q3", "finance.faq.a3"],
];

/** Study request, "how it works" steps, leasing overview, documents list and FAQ shown under the estimator. */
export default async function FinancingInfo({ start = {} }: { start?: StudyStart }) {
  const t = await getT();
  return (
    <>
      <section id="study" className="scroll-mt-24 border-t border-outline-variant bg-surface-container-low py-space-xl lg:py-space-2xl">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-space-xl px-margin-mobile md:px-margin lg:grid-cols-12 lg:px-margin-desktop">
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm lg:col-span-7">
            <p className="font-label-sm uppercase tracking-widest text-secondary">{t("finance.study.eyebrow")}</p>
            <h2 className="mt-1 font-headline-md text-headline-md text-primary">{t("finance.study.title")}</h2>
            <p className="mb-space-md mt-1 max-w-2xl font-body-md text-on-surface-variant">{t("finance.study.intro")}</p>
            <ContactRequestForm mode="financing" start={start} />
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm lg:col-span-5">
            <p className="font-label-sm uppercase tracking-widest text-secondary">{t("finance.how.eyebrow")}</p>
            <h2 className="mt-1 font-headline-md text-headline-md text-primary">{t("finance.how.title")}</h2>
            <div className="mt-space-md flex flex-col gap-space-md">
              {STEP_KEYS.map(([titleKey, textKey], index) => (
                <div key={titleKey} className="rounded-xl border border-outline-variant bg-surface-container-low p-space-md">
                  <div className="flex items-center gap-space-sm">
                    <span className="font-headline-sm text-headline-sm text-secondary">{String(index + 1).padStart(2, "0")}</span>
                    <h3 className="font-title-md text-primary">{t(titleKey)}</h3>
                  </div>
                  <p className="mt-1 font-body-sm text-on-surface-variant">{t(textKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-margin-mobile pb-space-2xl pt-space-xl md:px-margin lg:px-margin-desktop">
        <section className="grid gap-space-lg md:grid-cols-2">
          <article className="rounded-xl bg-surface-container-lowest p-space-lg">
            <h2 className="font-headline-sm text-primary">{t("finance.leasing_spain.title")}</h2>
            <p className="mt-1 font-body-md text-on-surface-variant">{t("finance.leasing_spain.text")}</p>
          </article>
          <article className="rounded-xl bg-surface-container-lowest p-space-lg">
            <h2 className="font-headline-sm text-primary">{t("finance.leasing_italy.title")}</h2>
            <p className="mt-1 font-body-md text-on-surface-variant">{t("finance.leasing_italy.text")}</p>
          </article>
        </section>

        <section className="mt-space-xl rounded-xl bg-surface-container-lowest p-space-lg">
          <h2 className="font-headline-sm text-primary">{t("finance.documents.title")}</h2>
          <ul className="mt-space-sm grid gap-space-xs font-body-md text-on-surface-variant">
            {DOCUMENT_KEYS.map((key) => (
              <li key={key} className="flex gap-space-xs">
                <span aria-hidden="true" className="text-secondary">✓</span>
                {t(key)}
              </li>
            ))}
          </ul>
          <p className="mt-space-md font-body-sm text-on-surface-variant">{t("finance.documents.footer")}</p>
        </section>
      </div>

      <section className="border-t border-outline-variant bg-surface-container-low py-space-2xl">
        <div className="mx-auto max-w-3xl px-margin-mobile text-center md:px-margin lg:px-margin-desktop">
          <span className="font-label-sm uppercase tracking-widest text-secondary">{t("finance.faq.eyebrow")}</span>
          <h2 className="mt-1 font-headline-md text-headline-md text-primary">{t("finance.faq.title")}</h2>
        </div>
        <div className="mx-auto mt-space-lg flex max-w-3xl flex-col gap-space-md px-margin-mobile md:px-margin lg:px-margin-desktop">
          {FAQ_KEYS.map(([qKey, aKey]) => (
            <details key={qKey} className="group rounded-lg border border-outline-variant bg-surface-container-lowest p-space-md">
              <summary className="flex cursor-pointer items-center justify-between gap-space-md font-title-md text-primary">
                {t(qKey)}
                <span aria-hidden="true" className="shrink-0 text-secondary transition-transform group-open:rotate-180">▼</span>
              </summary>
              <p className="mt-space-sm font-body-sm text-on-surface-variant">{t(aKey)}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

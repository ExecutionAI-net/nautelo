import ContactRequestForm, { type StudyStart } from "@/components/contact/ContactRequestForm";

const DOCUMENTS = [
  "Independent surveyor report on hull and engines",
  "Two years of company accounts, or personal tax returns",
  "Builder's certificate (new boat) or registry extract (used boat)",
  "Insurance quote or binder for the boat",
];

/** Study request, leasing overview and documents list shown under the estimator. */
export default function FinancingInfo({ start = {} }: { start?: StudyStart }) {
  return (
    <div className="mx-auto max-w-[1440px] px-margin-mobile pb-space-2xl md:px-margin lg:px-margin-desktop">
      <section id="study" className="mt-space-xl scroll-mt-24 rounded-xl bg-surface-container-lowest p-space-lg">
        <p className="font-label-sm uppercase tracking-widest text-secondary">Next step</p>
        <h2 className="font-headline-sm text-primary">Request a financing study</h2>
        <p className="mb-space-md mt-1 max-w-2xl font-body-md text-on-surface-variant">
          Tell us about the boat and we will come back with the options lenders in Spain and Italy usually offer for it. The estimate above is illustrative; a study is a first conversation, not a credit offer.
        </p>
        <ContactRequestForm mode="financing" start={start} />
      </section>

      <section className="mt-space-xl grid gap-space-lg md:grid-cols-2">
        <article className="rounded-xl bg-surface-container-lowest p-space-lg">
          <h2 className="font-headline-sm text-primary">Leasing in Spain</h2>
          <p className="mt-1 font-body-md text-on-surface-variant">
            Nautical leasing (leasing náutico) lets a person or a company use a boat while the lessor keeps legal title during the contract. It is often used for boats in charter or company use. Tax treatment depends on your situation, so confirm it with an adviser.
          </p>
        </article>
        <article className="rounded-xl bg-surface-container-lowest p-space-lg">
          <h2 className="font-headline-sm text-primary">Leasing in Italy</h2>
          <p className="mt-1 font-body-md text-on-surface-variant">
            In Italy a boat lease (locazione finanziaria nautica) is common for pleasure and commercial craft. VAT and registration rules apply, and lenders normally ask for a survey report. Confirm the details with an adviser.
          </p>
        </article>
      </section>

      <section className="mt-space-xl rounded-xl bg-surface-container-lowest p-space-lg">
        <h2 className="font-headline-sm text-primary">Documents lenders usually ask for</h2>
        <ul className="mt-space-sm grid gap-space-xs font-body-md text-on-surface-variant">
          {DOCUMENTS.map((d) => (
            <li key={d} className="flex gap-space-xs">
              <span aria-hidden="true" className="text-secondary">✓</span>
              {d}
            </li>
          ))}
        </ul>
        <p className="mt-space-md font-body-sm text-on-surface-variant">
          Nauta does not lend money and does not hold funds. Rates, terms and approval are decided by the lender.
        </p>
      </section>
    </div>
  );
}

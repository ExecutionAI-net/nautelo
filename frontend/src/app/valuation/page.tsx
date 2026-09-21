import type { Metadata } from "next";

import PageBand from "@/components/layout/PageBand";
import ValuationForm from "@/components/valuation/ValuationForm";

export const metadata: Metadata = {
  title: "What is my boat worth? Free valuation",
  description: "Free market-value estimate for your boat, based on comparable boats currently for sale on Nauta.",
};

const STEPS = [
  ["Enter the basics", "Type of boat, length and year built."],
  ["We compare", "We look at similar boats currently for sale on Nauta."],
  ["You get a range", "A price range and how many boats it rests on. Then list your boat in a few minutes."],
];

export default function ValuationPage() {
  return (
    <main className="w-full bg-surface">
      <PageBand eyebrow="Sell" title="What is my boat worth?" subtitle="A free estimate from comparable boats for sale on Nauta. No sign-up needed." />
      <section className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin lg:px-margin-desktop">
        <ValuationForm />
        <ol className="mx-auto mt-space-2xl grid max-w-4xl gap-space-lg md:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="rounded-xl bg-surface-container-lowest p-space-md">
              <span className="font-label-md text-secondary">Step {i + 1}</span>
              <h2 className="font-title-md">{title}</h2>
              <p className="font-body-sm text-on-surface-variant">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

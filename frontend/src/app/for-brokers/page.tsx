import type { Metadata } from "next";
import Link from "next/link";

import PageBand from "@/components/layout/PageBand";

export const metadata: Metadata = {
  title: "Nauta for brokers and dealers",
  description: "Reach buyers across Italy and Spain, manage your fleet and leads, and add your team. 30-day free trial.",
  alternates: { canonical: "/for-brokers/" },
};

const BENEFITS = [
  ["Real buyers", "Reach boat buyers in Italy, Spain and across Europe, with listings in English, Italian and Spanish."],
  ["Easy fleet management", "Add vessels with photos and video, edit any time, and see status at a glance."],
  ["Leads in one inbox", "Every enquiry lands in a shared inbox your whole team can answer."],
  ["Your team, your rules", "Invite colleagues by email and set who can edit listings, manage the team or read messages."],
  ["Your own brokerage page", "A public profile with logo, cover, specialties and your team, ready to share."],
  ["Flexible terms", "30-day free trial and no minimum term. Change plan when your fleet grows."],
];

const FAQ = [
  ["How much does it cost?", "Plans depend on how many listings you keep online. See the pricing page for the current plans."],
  ["Is there a free trial?", "Yes, 30 days. A card is required up front and you are only charged when the trial ends."],
  ["Can my colleagues use the account?", "Yes. Invite them by email; each plan includes a number of team seats."],
  ["Who approves my brokerage page?", "Our team reviews each new brokerage before it appears in the directory, usually within a day."],
];

export default function ForBrokersPage() {
  return (
    <main className="w-full bg-surface">
      <PageBand eyebrow="For brokers" title="Sell more boats with Nauta" subtitle="Everything a brokerage needs to list, manage and win buyers." />
      <section className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin lg:px-margin-desktop">
        <div className="flex flex-wrap gap-space-sm">
          <Link href="/register/broker/" className="rounded-lg bg-primary px-space-lg py-space-sm font-label-md text-on-primary">Open a broker account</Link>
          <Link href="/pricing/" className="rounded-lg bg-surface-container-low px-space-lg py-space-sm font-label-md">See pricing</Link>
        </div>
        <ul className="mt-space-xl grid gap-space-md md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(([title, text]) => (
            <li key={title} className="rounded-xl bg-surface-container-lowest p-space-md">
              <h2 className="font-title-md">{title}</h2>
              <p className="font-body-sm text-on-surface-variant">{text}</p>
            </li>
          ))}
        </ul>
        <h2 className="mt-space-2xl font-headline-sm">Questions</h2>
        <dl className="mt-space-md grid max-w-3xl gap-space-md">
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <dt className="font-title-md">{q}</dt>
              <dd className="font-body-md text-on-surface-variant">{a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-space-xl font-body-md">
          Questions before you start? <Link className="text-secondary underline" href="/contact/">Contact us</Link>.
        </p>
      </section>
    </main>
  );
}

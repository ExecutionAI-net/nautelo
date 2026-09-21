import Link from "next/link";

import type { EntityStatus } from "@/lib/auth/types";

const STEPS = [
  { href: "/dashboard/broker/profile/", title: "Complete your brokerage profile", body: "Name, contact details, city, logo and a short introduction." },
  { href: "/dashboard/broker/subscription/", title: "Choose a plan", body: "Start the free trial or pick a plan so you can publish vessels." },
  { href: "/dashboard/broker/team/", title: "Invite your team", body: "Add agents and managers. You can do this at any time." },
];

/** Home for a brokerage that is not live yet: the metrics need an active organisation, so guide instead. */
export default function OnboardingChecklist({ status }: { status: EntityStatus }) {
  const suspended = status === "SUSPENDED";
  return (
    <section aria-labelledby="onboarding-heading" className="mt-space-lg rounded-xl bg-surface-container-lowest p-space-xl shadow-sm">
      <h2 id="onboarding-heading" className="font-headline-md text-primary">
        {suspended ? "Your brokerage is suspended" : status === "PENDING" ? "Your brokerage is waiting for approval" : "Set up your brokerage"}
      </h2>
      <p className="mt-1 font-body-md text-on-surface-variant">
        {suspended
          ? "Contact support to reopen your organisation. Your data is kept."
          : status === "PENDING"
            ? "Our team is reviewing it. Until it is approved you can still finish your profile and plan."
            : "Finish these steps and submit for approval. The dashboard opens as soon as your brokerage is live."}
      </p>
      {suspended ? null : (
        <ol className="mt-space-md grid gap-space-sm">
          {STEPS.map((step, index) => (
            <li key={step.href}>
              <Link href={step.href} className="flex gap-space-md rounded-lg bg-surface-container-low p-space-md hover:bg-surface-container">
                <span aria-hidden="true" className="font-headline-sm text-secondary">{index + 1}</span>
                <span>
                  <span className="block font-title-md text-primary">{step.title}</span>
                  <span className="block font-body-sm text-on-surface-variant">{step.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

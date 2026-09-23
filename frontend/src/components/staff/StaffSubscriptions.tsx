"use client";

import { useCallback, useEffect, useState } from "react";

import { formatPrice } from "@/lib/api/plans";
import {
  VISIBILITY_LABELS,
  assignPlan,
  fetchStaffPlans,
  fetchSubscribers,
  updateStaffPlan,
  type StaffPlan,
  type SubscriptionPage,
} from "@/lib/api/staffPlans";

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-2 font-body-md text-primary focus:outline-none";
const CARD = "rounded-xl bg-surface-container-lowest p-space-lg shadow-sm";
const BTN = "rounded-lg bg-primary px-space-md py-2 font-body-md text-on-primary hover:bg-primary-container disabled:opacity-50";

function limit(value: number | null, unit: string): string {
  return value === null ? `Unlimited ${unit}` : `${value} ${unit}`;
}

export default function StaffSubscriptions() {
  const [plans, setPlans] = useState<StaffPlan[]>([]);
  const [page, setPage] = useState(1);
  const [planFilter, setPlanFilter] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<SubscriptionPage | null>(null);
  const [editing, setEditing] = useState<StaffPlan | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [renewals, setRenewals] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    try {
      const [planRows, subscribers] = await Promise.all([fetchStaffPlans(), fetchSubscribers({ page, plan: planFilter, q })]);
      setPlans(planRows);
      setData(subscribers);
    } catch {
      setMessage("The subscriptions could not be loaded.");
    }
  }, [page, planFilter, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on filter change
    void reload();
  }, [reload]);

  async function run(action: () => Promise<unknown>, done: string) {
    setMessage(null);
    try {
      await action();
      setMessage(done);
      await reload();
    } catch {
      setMessage("The change was refused.");
    }
  }

  const summary = data?.summary;

  return (
    <section className="flex flex-col gap-space-lg">
      <div>
        <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">Staff / Subscriptions</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Subscriptions</h1>
        <p className="mt-space-xs max-w-3xl font-body-md text-on-surface-variant">
          Membership tiers, what each brokerage is subscribed to, and how much of its listing and seat allowance it uses.
        </p>
      </div>

      {message ? (
        <p role="status" className="rounded-lg bg-surface-container-low px-space-md py-space-sm font-body-md text-primary">{message}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-4">
        <div className={CARD}>
          <span className="font-label-sm uppercase text-on-surface-variant">Monthly Recurring Revenue</span>
          <p className="mt-space-sm font-headline-md text-headline-md text-primary">{summary ? formatPrice(summary.monthly_recurring_revenue, "EUR") : "-"}</p>
        </div>
        <div className={CARD}>
          <span className="font-label-sm uppercase text-on-surface-variant">Annual Run-Rate</span>
          <p className="mt-space-sm font-headline-md text-headline-md text-primary">{summary ? formatPrice(summary.annual_run_rate, "EUR") : "-"}</p>
        </div>
        <div className={CARD}>
          <span className="font-label-sm uppercase text-on-surface-variant">Subscribed Brokerages</span>
          <p className="mt-space-sm font-headline-md text-headline-md text-primary">{summary?.subscribed_brokers ?? "-"}</p>
          <p className="font-body-sm text-on-surface-variant">
            {plans.map((plan) => `${plan.name.split(" ")[0]}: ${summary?.by_plan[plan.slug] ?? 0}`).join(" · ")}
          </p>
        </div>
        <div className={CARD}>
          <span className="font-label-sm uppercase text-on-surface-variant">Without a plan</span>
          <p className="mt-space-sm font-headline-md text-headline-md text-primary">{summary?.unassigned_brokers ?? "-"}</p>
          <p className="font-body-sm text-on-surface-variant">No limits apply until a tier is assigned</p>
        </div>
      </div>

      <div>
        <h2 className="font-headline-sm text-headline-sm text-primary">Broker plans</h2>
        <div className="mt-space-md grid grid-cols-1 gap-space-lg lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className={`${CARD} flex flex-col gap-space-sm`}>
              <div className="flex items-start justify-between gap-space-sm">
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-primary">{plan.name}</h3>
                  <p className="font-body-sm text-on-surface-variant">{plan.subscriber_count} agencies{plan.is_active ? "" : " - inactive"}</p>
                </div>
                <p className="font-headline-sm text-headline-sm text-primary">
                  {formatPrice(plan.monthly_price, plan.currency)}
                  <span className="font-body-sm text-on-surface-variant"> / month</span>
                </p>
              </div>
              <dl className="flex flex-col gap-space-xs font-body-md">
                <div className="flex justify-between border-b border-surface-container pb-space-xs">
                  <dt className="font-label-sm uppercase text-on-surface-variant">Inventory limit</dt>
                  <dd className="text-primary">{limit(plan.listing_limit, "vessels")}</dd>
                </div>
                <div className="flex justify-between border-b border-surface-container pb-space-xs">
                  <dt className="font-label-sm uppercase text-on-surface-variant">Team seats</dt>
                  <dd className="text-primary">{limit(plan.seat_limit, "seats")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-label-sm uppercase text-on-surface-variant">Directory profile</dt>
                  <dd className="text-primary">{VISIBILITY_LABELS[plan.profile_visibility] ?? plan.profile_visibility}</dd>
                </div>
              </dl>
              <button type="button" className="self-start font-title-md text-body-sm text-secondary hover:text-primary" onClick={() => setEditing(plan)}>
                Edit tier specs
              </button>
            </div>
          ))}
        </div>
      </div>

      {editing ? (
        <form
          className={`${CARD} grid gap-space-md sm:grid-cols-2 lg:grid-cols-4`}
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                updateStaffPlan(editing.id, {
                  monthly_price: editing.monthly_price,
                  listing_limit: editing.listing_limit,
                  seat_limit: editing.seat_limit,
                  profile_visibility: editing.profile_visibility,
                  is_active: editing.is_active,
                }),
              `${editing.name} updated.`,
            ).then(() => setEditing(null));
          }}
        >
          <h3 className="font-headline-sm text-headline-sm text-primary sm:col-span-2 lg:col-span-4">Edit {editing.name}</h3>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Monthly price
            <input className={FIELD} type="number" min="0" step="0.01" value={editing.monthly_price} onChange={(e) => setEditing({ ...editing, monthly_price: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Listing limit (empty = unlimited)
            <input className={FIELD} type="number" min="0" value={editing.listing_limit ?? ""} onChange={(e) => setEditing({ ...editing, listing_limit: e.target.value === "" ? null : Number(e.target.value) })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Seat limit (empty = unlimited)
            <input className={FIELD} type="number" min="0" value={editing.seat_limit ?? ""} onChange={(e) => setEditing({ ...editing, seat_limit: e.target.value === "" ? null : Number(e.target.value) })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Directory profile
            <select className={FIELD} value={editing.profile_visibility} onChange={(e) => setEditing({ ...editing, profile_visibility: Number(e.target.value) })}>
              {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-space-xs font-body-md text-primary">
            <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
            Offered to brokerages
          </label>
          <div className="flex gap-space-sm sm:col-span-2 lg:col-span-3 lg:justify-end">
            <button type="button" className="rounded-lg bg-surface-container px-space-md py-2 font-body-md text-primary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className={BTN}>Save tier</button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-col gap-space-md">
        <div className="flex flex-wrap items-center gap-space-sm">
          <input
            className={`${FIELD} max-w-xs`}
            placeholder="Search brokerages"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          {[{ value: "", label: "All tiers" }, ...plans.map((p) => ({ value: p.slug, label: p.name })), { value: "none", label: "No plan" }].map((chip) => (
            <button
              key={chip.value || "all"}
              type="button"
              aria-pressed={planFilter === chip.value}
              onClick={() => {
                setPage(1);
                setPlanFilter(chip.value);
              }}
              className={`rounded-lg px-space-md py-1.5 font-body-sm ${planFilter === chip.value ? "bg-primary text-on-primary" : "bg-surface-container text-primary hover:bg-surface-container-high"}`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider">
              <tr>
                <th scope="col" className="py-3 px-4">Brokerage</th>
                <th scope="col" className="py-3 px-4">Tier</th>
                <th scope="col" className="py-3 px-4">Capacity &amp; seats</th>
                <th scope="col" className="py-3 px-4">Fee &amp; renewal</th>
                <th scope="col" className="py-3 px-4 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {(data?.results ?? []).map((row) => {
                const over = row.listing_limit !== null && row.listings_used > row.listing_limit;
                const renewal = renewals[row.id] ?? row.plan_renews_at ?? "";
                return (
                  <tr key={row.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-title-md text-primary">{row.name}</div>
                      <div className="text-on-surface-variant">{[row.city, row.country_code].filter(Boolean).join(", ") || row.status}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        aria-label={`Tier for ${row.name}`}
                        className={FIELD}
                        value={row.plan_slug ?? ""}
                        onChange={(e) => {
                          const next = e.target.value;
                          const name = plans.find((plan) => plan.slug === next)?.name ?? "no plan";
                          // The change applies at once and changes what the brokerage may list: ask first.
                          if (!window.confirm(`Move ${row.name} to ${name}?`)) {
                            e.target.value = row.plan_slug ?? "";
                            return;
                          }
                          void run(() => assignPlan(row.id, next || null, renewal || null), `${row.name} moved to ${name}.`);
                        }}
                      >
                        <option value="">No plan</option>
                        {plans.map((plan) => (
                          <option key={plan.slug} value={plan.slug}>{plan.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className={over ? "text-error" : "text-primary"}>
                        {row.listings_used} / {row.listing_limit ?? "∞"} vessels{over ? " (over limit)" : ""}
                      </div>
                      <div className="text-on-surface-variant">{row.seats_used} / {row.seat_limit ?? "∞"} seats</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {row.monthly_price ? (
                        <div className="text-primary">{formatPrice(row.monthly_price, row.currency ?? "EUR")} / mo</div>
                      ) : (
                        <div className="text-on-surface-variant">-</div>
                      )}
                      {row.plan_slug ? (
                        <input
                          aria-label={`Renewal date for ${row.name}`}
                          type="date"
                          className="mt-1 rounded bg-surface-container-low px-space-xs py-1 text-on-surface-variant"
                          value={renewal}
                          onChange={(e) => setRenewals({ ...renewals, [row.id]: e.target.value })}
                        />
                      ) : null}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {row.plan_slug ? (
                        <button
                          type="button"
                          className="font-title-md text-body-sm text-secondary hover:text-primary disabled:opacity-40"
                          disabled={renewal === (row.plan_renews_at ?? "")}
                          onClick={() => void run(() => assignPlan(row.id, row.plan_slug, renewal || null), "Renewal date saved.")}
                        >
                          Save renewal
                        </button>
                      ) : (
                        <span className="font-body-sm text-on-surface-variant">Choose a plan to set a renewal date</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data && data.results.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-space-md px-4 text-on-surface-variant">No brokerages match.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between font-body-sm text-on-surface-variant">
          <span>{data ? `${data.count} brokerages` : " "}</span>
          <div className="flex gap-space-sm">
            <button type="button" disabled={!data?.previous} className="rounded bg-surface-container px-2.5 py-1 text-primary disabled:opacity-50" onClick={() => setPage(page - 1)}>Previous</button>
            <button type="button" disabled={!data?.next} className="rounded bg-surface-container px-2.5 py-1 text-primary disabled:opacity-50" onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </div>
    </section>
  );
}

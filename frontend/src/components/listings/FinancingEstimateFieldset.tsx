"use client";

import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n";
import type { SellerType } from "@/lib/api/listings";
import type { Locale } from "@/lib/i18n/directory";

export interface FinanceFieldsetState {
  show_finance_estimate: boolean;
  use_custom_assumptions: boolean;
  finance_rate_override_percent: string;
  finance_term_override_months: string;
  finance_down_payment_override_percent: string;
}

export const EMPTY_FINANCE_FIELDSET_STATE: FinanceFieldsetState = {
  // Spec §18.4: "Default for new broker listing: off."
  show_finance_estimate: false,
  use_custom_assumptions: false,
  finance_rate_override_percent: "",
  finance_term_override_months: "",
  finance_down_payment_override_percent: "",
};

export interface FinanceDefaults {
  annual_rate_percent: string;
  term_months: number;
  down_payment_percent: string;
}

/**
 * The fragment Phase 16 merges into its draft PATCH body.
 *
 * Spec §18.4: "When off, override fields are hidden and cleared from the
 * submitted effective UI state; stored overrides may remain but are ignored."
 * So the overrides are *omitted*, never sent as nulls: sending nulls would ask
 * the backend to erase values the spec says may remain, and
 * finance.listing_quotes already ignores them while the flag is off.
 */
export function financeFieldsetPayload(
  state: FinanceFieldsetState,
  { overridesEnabled = true }: { overridesEnabled?: boolean } = {},
): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {
    show_finance_estimate: state.show_finance_estimate,
  };
  // With overrides globally disabled (spec §17.2) the custom fields are not on
  // screen, so a stale use_custom_assumptions must not smuggle them into the body.
  if (!state.show_finance_estimate || !overridesEnabled || !state.use_custom_assumptions) {
    return payload;
  }
  if (state.finance_rate_override_percent !== "") {
    payload.finance_rate_override_percent = state.finance_rate_override_percent;
  }
  if (state.finance_term_override_months !== "") {
    payload.finance_term_override_months = Number(state.finance_term_override_months);
  }
  if (state.finance_down_payment_override_percent !== "") {
    payload.finance_down_payment_override_percent =
      state.finance_down_payment_override_percent;
  }
  return payload;
}

/**
 * Spec §18.4's "Financing estimate" field group, for step 8 of spec §25.2's
 * listing form. Phase 16 owns that form and mounts this group; this phase owns
 * the group's rules.
 *
 * Spec §18.4: "Private-seller forms must neither render the fields nor accept
 * them through API payloads." This component returns null for a private seller
 * — not a hidden container, because spec §39 forbids hiding prohibited fields
 * with CSS — and the backend refuses the fields independently with
 * `finance_not_allowed_for_private_seller`.
 */
export default function FinancingEstimateFieldset({
  locale,
  sellerType,
  overridesEnabled,
  defaults,
  value,
  onChange,
}: {
  locale: Locale;
  sellerType: SellerType;
  overridesEnabled: boolean;
  defaults: FinanceDefaults;
  value: FinanceFieldsetState;
  onChange: (next: FinanceFieldsetState) => void;
}) {
  const t = useT();
  if (sellerType !== "BROKER") {
    return null;
  }

  function set<K extends keyof FinanceFieldsetState>(
    key: K,
    next: FinanceFieldsetState[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  function overrideField(
    key:
      | "finance_rate_override_percent"
      | "finance_term_override_months"
      | "finance_down_payment_override_percent",
    labelKey: string,
  ) {
    return (
      <label className="flex flex-col gap-space-xs font-body-sm">
        <span>{t(labelKey as MessageKey)}</span>
        <input
          name={key}
          value={value[key]}
          inputMode="decimal"
          onChange={(event) => set(key, event.target.value)}
          className="rounded-lg border border-outline-variant px-space-sm py-space-xs"
        />
      </label>
    );
  }

  return (
    <fieldset className="flex flex-col gap-space-sm">
      <legend className="font-title-md text-title-md">
        {t("listing.finance_group_title")}
      </legend>
      <p className="font-body-sm text-on-surface-variant">
        {t("listing.finance_group_help")}
      </p>

      <label className="flex items-center gap-space-sm font-body-md">
        <input
          type="checkbox"
          checked={value.show_finance_estimate}
          onChange={(event) => set("show_finance_estimate", event.target.checked)}
        />
        <span>{t("listing.finance_toggle")}</span>
      </label>

      {value.show_finance_estimate ? (
        <div className="flex flex-col gap-space-sm">
          <div className="font-body-sm text-on-surface-variant">
            <p>{t("listing.finance_platform_defaults")}</p>
            <dl className="mt-space-xs grid grid-cols-2 gap-x-space-sm gap-y-space-xs">
              <dt>{t("finance.annual_rate")}</dt>
              <dd className="text-right">{`${defaults.annual_rate_percent}%`}</dd>
              <dt>{t("finance.term")}</dt>
              <dd className="text-right">
                {t("finance.months", { count: defaults.term_months })}
              </dd>
              <dt>{t("finance.down_payment")}</dt>
              <dd className="text-right">{`${defaults.down_payment_percent}%`}</dd>
            </dl>
          </div>

          {/* Spec §17.2: staff can disable the override capability globally. */}
          {overridesEnabled ? (
            <label className="flex items-center gap-space-sm font-body-md">
              <input
                type="checkbox"
                checked={value.use_custom_assumptions}
                onChange={(event) => set("use_custom_assumptions", event.target.checked)}
              />
              <span>{t("listing.finance_custom_assumptions")}</span>
            </label>
          ) : null}

          {overridesEnabled && value.use_custom_assumptions ? (
            <div className="grid gap-space-sm sm:grid-cols-3">
              {overrideField("finance_rate_override_percent", "finance.annual_rate")}
              {overrideField("finance_term_override_months", "finance.term")}
              {overrideField(
                "finance_down_payment_override_percent",
                "finance.down_payment",
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

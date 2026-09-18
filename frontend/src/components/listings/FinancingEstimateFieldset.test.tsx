import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import FinancingEstimateFieldset, {
  EMPTY_FINANCE_FIELDSET_STATE,
  financeFieldsetPayload,
  type FinanceFieldsetState,
} from "@/components/listings/FinancingEstimateFieldset";

const DEFAULTS = {
  annual_rate_percent: "5.0000",
  term_months: 48,
  down_payment_percent: "20.0000",
};

function renderGroup(
  state: FinanceFieldsetState = EMPTY_FINANCE_FIELDSET_STATE,
  props: Partial<React.ComponentProps<typeof FinancingEstimateFieldset>> = {},
) {
  const onChange = vi.fn();
  render(
    <FinancingEstimateFieldset
      locale="en"
      sellerType="BROKER"
      overridesEnabled
      defaults={DEFAULTS}
      value={state}
      onChange={onChange}
      {...props}
    />,
  );
  return onChange;
}

describe("FinancingEstimateFieldset", () => {
  it("renders nothing at all for a private seller", () => {
    const { container } = render(
      <FinancingEstimateFieldset
        locale="en"
        sellerType="PRIVATE"
        overridesEnabled
        defaults={DEFAULTS}
        value={EMPTY_FINANCE_FIELDSET_STATE}
        onChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("is titled and labelled exactly as spec 18.4 fixes it", () => {
    renderGroup();

    expect(screen.getByRole("group", { name: "Financing estimate" })).toBeInTheDocument();
    expect(
      screen.getByLabelText("Show an estimated monthly payment on this listing"),
    ).not.toBeChecked();
  });

  it("says the estimate is illustrative", () => {
    renderGroup();

    expect(screen.getByText(/illustrative monthly payment/)).toBeInTheDocument();
  });

  it("hides the assumption controls while the toggle is off", () => {
    renderGroup();

    expect(
      screen.queryByLabelText("Use custom assumptions for this listing"),
    ).not.toBeInTheDocument();
  });

  it("shows the platform defaults and the custom option when the toggle is on", () => {
    renderGroup({ ...EMPTY_FINANCE_FIELDSET_STATE, show_finance_estimate: true });

    expect(screen.getByText("5.0000%")).toBeInTheDocument();
    expect(screen.getByText("48 months")).toBeInTheDocument();
    expect(screen.getByText("20.0000%")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Use custom assumptions for this listing"),
    ).toBeInTheDocument();
  });

  it("offers no custom assumptions when staff disabled overrides globally", () => {
    renderGroup(
      { ...EMPTY_FINANCE_FIELDSET_STATE, show_finance_estimate: true },
      { overridesEnabled: false },
    );

    expect(
      screen.queryByLabelText("Use custom assumptions for this listing"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("5.0000%")).toBeInTheDocument();
  });

  it("reports the toggle upward rather than holding its own truth", async () => {
    const onChange = renderGroup();

    await userEvent.click(
      screen.getByLabelText("Show an estimated monthly payment on this listing"),
    );

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FINANCE_FIELDSET_STATE,
      show_finance_estimate: true,
    });
  });
});

describe("financeFieldsetPayload", () => {
  it("sends only the flag when the toggle is off", () => {
    expect(
      financeFieldsetPayload({
        show_finance_estimate: false,
        use_custom_assumptions: true,
        finance_rate_override_percent: "3.5000",
        finance_term_override_months: "60",
        finance_down_payment_override_percent: "10.0000",
      }),
    ).toEqual({ show_finance_estimate: false });
  });

  it("sends only the flag when custom assumptions are not used", () => {
    expect(
      financeFieldsetPayload({
        ...EMPTY_FINANCE_FIELDSET_STATE,
        show_finance_estimate: true,
      }),
    ).toEqual({ show_finance_estimate: true });
  });

  it("sends the overrides the broker actually filled in", () => {
    expect(
      financeFieldsetPayload({
        show_finance_estimate: true,
        use_custom_assumptions: true,
        finance_rate_override_percent: "3.5000",
        finance_term_override_months: "60",
        finance_down_payment_override_percent: "",
      }),
    ).toEqual({
      show_finance_estimate: true,
      finance_rate_override_percent: "3.5000",
      finance_term_override_months: 60,
    });
  });
});

describe("custom assumption fields", () => {
  const ON = {
    ...EMPTY_FINANCE_FIELDSET_STATE,
    show_finance_estimate: true,
    use_custom_assumptions: true,
  };

  it("shows the three override inputs only when custom assumptions are on", () => {
    renderGroup(ON);

    expect(screen.getAllByRole("textbox")).toHaveLength(3);
  });

  it("shows no override inputs when custom assumptions are off", () => {
    renderGroup({ ...ON, use_custom_assumptions: false });

    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("reports an override edit upward", async () => {
    const onChange = renderGroup(ON);

    await userEvent.type(screen.getByRole("textbox", { name: "Annual rate" }), "3");

    expect(onChange).toHaveBeenLastCalledWith({
      ...ON,
      finance_rate_override_percent: "3",
    });
  });

  it("omits the overrides from the payload when staff disabled them globally", () => {
    expect(
      financeFieldsetPayload(
        { ...ON, finance_rate_override_percent: "3.5000" },
        { overridesEnabled: false },
      ),
    ).toEqual({ show_finance_estimate: true });
  });
});

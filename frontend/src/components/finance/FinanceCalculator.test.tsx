import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FinanceCalculator from "@/components/finance/FinanceCalculator";
import { ApiError } from "@/lib/api/client";

const requestFinanceQuote = vi.fn();

vi.mock("@/lib/api/finance-quote", () => ({
  requestFinanceQuote: (...args: unknown[]) => requestFinanceQuote(...args),
}));

const QUOTE = {
  currency: "EUR",
  price: "459000.00",
  down_payment_amount: "91800.00",
  principal: "367200.00",
  annual_rate_percent: "5.0000",
  term_months: 48,
  down_payment_percent: "20.0000",
  monthly_payment: "8456.36",
  total_payment: "405905.12",
  total_interest: "38705.12",
  configuration_version: 1,
  disclaimer_key: "finance.illustrative_disclaimer",
  assumption_sources: {
    annual_rate_percent: "GLOBAL" as const,
    term_months: "GLOBAL" as const,
    down_payment_percent: "GLOBAL" as const,
  },
};

// Exactly the shape GET /api/v1/platform/public-settings/ publishes under
// `finance_configuration` (Task 2). These are the seeded spec §1 values; the
// point of the prop is that they arrive from the server, not that they are
// these particular numbers.
const DEFAULTS = {
  version: 1,
  annual_rate_percent: "5.0000",
  term_months: 48,
  down_payment_percent: "20.0000",
};

beforeEach(() => {
  requestFinanceQuote.mockReset();
});

describe("FinanceCalculator with a listing", () => {
  it("never sends the query price and uses the server's", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(
      <FinanceCalculator
        locale="en"
        listingId="abc"
        fallbackPrice="1.00"
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    await waitFor(() => expect(requestFinanceQuote).toHaveBeenCalled());
    expect(requestFinanceQuote).toHaveBeenCalledWith({ listing_id: "abc" });
    await waitFor(() => expect(screen.getByText("€8,456.36")).toBeInTheDocument());
    expect(screen.getByTestId("finance-price")).toHaveTextContent("€459,000.00");
  });

  it("lets the listing's own assumptions overwrite the platform defaults", async () => {
    requestFinanceQuote.mockResolvedValue({
      ...QUOTE,
      annual_rate_percent: "3.5000",
      term_months: 36,
      down_payment_percent: "10.0000",
    });
    render(
      <FinanceCalculator
        locale="en"
        listingId="abc"
        fallbackPrice={null}
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText("Annual rate")).toHaveValue("3.5000"));
    expect(screen.getByLabelText("Term")).toHaveValue("36");
    expect(screen.getByLabelText("Down payment")).toHaveValue("10.0000");
  });

  it("shows the query price only as the loading placeholder", () => {
    requestFinanceQuote.mockReturnValue(new Promise(() => {}));
    render(
      <FinanceCalculator
        locale="en"
        listingId="abc"
        fallbackPrice="1.00"
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    expect(screen.getByTestId("finance-price")).toHaveTextContent("€1.00");
    expect(screen.queryByText("€8,456.36")).not.toBeInTheDocument();
  });

  it("sends an explored term with the listing and still never a price", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(
      <FinanceCalculator
        locale="en"
        listingId="abc"
        fallbackPrice={null}
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );
    await waitFor(() => expect(screen.getByText("€8,456.36")).toBeInTheDocument());

    const term = screen.getByLabelText("Term");
    await userEvent.clear(term);
    await userEvent.type(term, "60");
    await userEvent.click(screen.getByRole("button", { name: "Recalculate" }));

    await waitFor(() =>
      expect(requestFinanceQuote).toHaveBeenLastCalledWith({
        listing_id: "abc",
        annual_rate_percent: "5.0000",
        term_months: 60,
        down_payment_percent: "20.0000",
      }),
    );
  });

  it("falls back to the plain calculator when the listing shows no estimate", async () => {
    requestFinanceQuote.mockRejectedValue(
      new ApiError(400, "finance_not_available_for_listing", "nope"),
    );
    render(
      <FinanceCalculator
        locale="en"
        listingId="abc"
        fallbackPrice={null}
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/This listing has no financing estimate/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Price")).toBeEnabled();
    // The stale-link fallback is still a usable calculator, not an empty one:
    // the platform defaults the page arrived with are still in the fields.
    expect(screen.getByLabelText("Annual rate")).toHaveValue("5.0000");
  });

  it("always shows the disclaimer", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(
      <FinanceCalculator
        locale="en"
        listingId="abc"
        fallbackPrice={null}
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    expect(screen.getByText(/Illustrative estimate only/)).toBeInTheDocument();
  });
});

describe("FinanceCalculator without a listing", () => {
  it("opens pre-filled with the platform's real assumptions and asks for the price", () => {
    render(
      <FinanceCalculator
        locale="en"
        listingId={null}
        fallbackPrice={null}
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    // Spec §2.1: real current configuration, handed down by the server — not a
    // hard-coded copy, and not an empty form.
    expect(screen.getByLabelText("Annual rate")).toHaveValue("5.0000");
    expect(screen.getByLabelText("Term")).toHaveValue("48");
    expect(screen.getByLabelText("Down payment")).toHaveValue("20.0000");
    // Price is the visitor's to supply, and nothing is requested until they do.
    expect(screen.getByLabelText("Price")).toHaveValue("");
    expect(requestFinanceQuote).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Recalculate" })).toBeDisabled();
  });

  it("opens empty rather than inventing numbers when no configuration is active", () => {
    render(
      <FinanceCalculator
        locale="en"
        listingId={null}
        fallbackPrice={null}
        currency="EUR"
        defaults={null}
      />,
    );

    expect(screen.getByLabelText("Annual rate")).toHaveValue("");
    expect(screen.getByLabelText("Term")).toHaveValue("");
    expect(screen.getByLabelText("Down payment")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Recalculate" })).toBeDisabled();
  });

  it("sends every value itself in manual mode", async () => {
    requestFinanceQuote.mockResolvedValue({ ...QUOTE, configuration_version: null });
    render(
      <FinanceCalculator
        locale="en"
        listingId={null}
        fallbackPrice={null}
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    await userEvent.type(screen.getByLabelText("Price"), "459000.00");
    await userEvent.click(screen.getByRole("button", { name: "Recalculate" }));

    await waitFor(() =>
      expect(requestFinanceQuote).toHaveBeenCalledWith({
        price: "459000.00",
        currency: "EUR",
        annual_rate_percent: "5.0000",
        term_months: 48,
        down_payment_percent: "20.0000",
      }),
    );
  });
});

describe("FinanceCalculator with a hostile ?price=", () => {
  it.each(["abc", "NaN", "1e999", "-5", "12,5", "<script>"])(
    "drops %j instead of crashing the page",
    (hostile) => {
      requestFinanceQuote.mockReturnValue(new Promise(() => {}));
      render(
        <FinanceCalculator
          locale="en"
          listingId="abc"
          fallbackPrice={hostile}
          currency="EUR"
          defaults={DEFAULTS}
        />,
      );

      expect(screen.getByTestId("finance-price")).toBeEmptyDOMElement();
    },
  );
});

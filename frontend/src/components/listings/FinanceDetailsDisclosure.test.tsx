import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FinanceDetailsDisclosure from "@/components/listings/FinanceDetailsDisclosure";
import type { FinanceQuote } from "@/lib/api/finance-quote";
import type { Locale } from "@/lib/i18n/directory";
import type { MessageKey } from "@/i18n";
import { testT, withMessages } from "@/i18n/testing";

const requestFinanceQuote = vi.fn();

vi.mock("@/lib/api/finance-quote", () => ({
  requestFinanceQuote: (...args: unknown[]) => requestFinanceQuote(...args),
}));

// ICU puts a no-break space (U+00A0 or U+202F, depending on the build) before
// the euro sign in it-IT / es-ES; CI runs Node 22 and local may be newer.
const norm = (value: string) => value.replace(/[  ]/g, " ");
const money = (expected: string) =>
  screen.getByText((content) => norm(content) === expected);

const QUOTE: FinanceQuote = {
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
    annual_rate_percent: "GLOBAL",
    term_months: "GLOBAL",
    down_payment_percent: "GLOBAL",
  },
};

const LOCALES: readonly Locale[] = ["en", "it", "es"];

beforeEach(() => {
  requestFinanceQuote.mockReset();
});

function showButton(locale: Locale = "en") {
  return screen.getByRole("button", { name: testT(locale)("finance.details.show") });
}

describe("FinanceDetailsDisclosure", () => {
  it("asks for nothing until it is opened", () => {
    render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />));

    expect(requestFinanceQuote).not.toHaveBeenCalled();
  });

  it("renders server-calculated figures, never client arithmetic", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />));

    await userEvent.click(screen.getByRole("button", { name: "Show assumptions" }));

    await waitFor(() => expect(screen.getByText("€91,800.00")).toBeInTheDocument());
    expect(requestFinanceQuote).toHaveBeenCalledWith({ listing_id: "abc" });
    expect(screen.getByText("€367,200.00")).toBeInTheDocument();
    expect(screen.getByText("€405,905.12")).toBeInTheDocument();
    expect(screen.getByText("€38,705.12")).toBeInTheDocument();
    expect(screen.getByText("48 months")).toBeInTheDocument();
    expect(screen.getByText("5.0000%")).toBeInTheDocument();
  });

  it("fetches once even when it is opened and closed repeatedly", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />));

    await userEvent.click(screen.getByRole("button", { name: "Show assumptions" }));
    await waitFor(() => expect(screen.getByText("€91,800.00")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Hide assumptions" }));
    await userEvent.click(screen.getByRole("button", { name: "Show assumptions" }));

    expect(requestFinanceQuote).toHaveBeenCalledTimes(1);
  });

  it("says so when the estimate cannot be calculated", async () => {
    requestFinanceQuote.mockRejectedValue(new Error("boom"));
    render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />));

    await userEvent.click(screen.getByRole("button", { name: "Show assumptions" }));

    await waitFor(() =>
      expect(
        screen.getByText("The estimate could not be calculated right now."),
      ).toBeInTheDocument(),
    );
  });

  // 429 (throttled), 5xx and a network failure are the three ways the POST can
  // fail; all three are the same answer to a reader.
  it.each([
    ["a throttled request", Object.assign(new Error("Too many requests"), { status: 429 })],
    ["a server error", Object.assign(new Error("Server error"), { status: 503 })],
    ["a network failure", new TypeError("Failed to fetch")],
  ])("reports %s without breaking the card", async (_label, failure) => {
    requestFinanceQuote.mockRejectedValue(failure);
    render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />));

    await userEvent.click(showButton());

    await waitFor(() =>
      expect(
        screen.getByText("The estimate could not be calculated right now."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("finance-assumptions")).not.toBeInTheDocument();
  });

  it("retries on the next open after a failure, and clears the message on success", async () => {
    requestFinanceQuote.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(QUOTE);
    render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />));

    await userEvent.click(showButton());
    await waitFor(() =>
      expect(
        screen.getByText("The estimate could not be calculated right now."),
      ).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: "Hide assumptions" }));
    await userEvent.click(showButton());

    await waitFor(() => expect(screen.getByText("€91,800.00")).toBeInTheDocument());
    expect(requestFinanceQuote).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByText("The estimate could not be calculated right now."),
    ).not.toBeInTheDocument();
  });

  it("announces that it is calculating while the quote is in flight", async () => {
    let settle!: (quote: FinanceQuote) => void;
    requestFinanceQuote.mockReturnValue(
      new Promise<FinanceQuote>((resolve) => {
        settle = resolve;
      }),
    );
    render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />));

    await userEvent.click(showButton());

    const live = screen.getByRole("status");
    expect(within(live).getByText("Calculating…")).toBeInTheDocument();

    await act(async () => {
      settle(QUOTE);
    });

    await waitFor(() => expect(screen.queryByText("Calculating…")).not.toBeInTheDocument());
    expect(within(live).getByTestId("finance-assumptions")).toBeInTheDocument();
  });

  it("wires the button to the panel it controls", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />));

    const button = showButton();
    expect(button).toHaveAttribute("aria-expanded", "false");
    const panelId = button.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).not.toBeNull();

    await userEvent.click(button);

    expect(screen.getByRole("button", { name: "Hide assumptions" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await waitFor(() =>
      expect(document.getElementById(panelId!)).toContainElement(
        screen.getByTestId("finance-assumptions"),
      ),
    );
  });

  it("opens and closes from the keyboard alone", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />));

    await userEvent.tab();
    expect(showButton()).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByTestId("finance-assumptions")).toBeInTheDocument());

    await userEvent.keyboard(" ");
    expect(screen.queryByTestId("finance-assumptions")).not.toBeInTheDocument();
    expect(showButton()).toHaveFocus();
  });

  // Spec 2.5: the mandated sentence accompanies every result the disclosure
  // shows, and is programmatically tied to the figures it qualifies.
  it.each(LOCALES)("carries the mandated disclaimer with its figures (%s)", async (locale) => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(withMessages(locale, <FinanceDetailsDisclosure locale={locale} listingId="abc" />));

    await userEvent.click(showButton(locale));

    const rows = await screen.findByTestId("finance-assumptions");
    const disclaimer = testT(locale)("finance.illustrative_disclaimer");
    expect(screen.getByText(disclaimer)).toBeInTheDocument();
    expect(rows).toHaveAccessibleDescription(disclaimer);
  });

  it.each(LOCALES)("labels every row in %s", async (locale) => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(withMessages(locale, <FinanceDetailsDisclosure locale={locale} listingId="abc" />));

    await userEvent.click(showButton(locale));
    await screen.findByTestId("finance-assumptions");

    for (const key of [
      "finance.down_payment",
      "finance.amount_financed",
      "finance.term",
      "finance.annual_rate",
      "finance.total_installments",
      "finance.total_interest",
    ]) {
      expect(screen.getByText(testT(locale)(key as MessageKey))).toBeInTheDocument();
    }
    expect(
      screen.getByText(testT(locale)("finance.months", { count: 48 })),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: testT(locale)("finance.details.hide") }),
    ).toBeInTheDocument();
  });

  it.each([
    ["en" as const, "€91,800.00", "€367,200.00"],
    ["it" as const, "91.800,00 €", "367.200,00 €"],
    ["es" as const, "91.800,00 €", "367.200,00 €"],
  ])("formats the figures for %s", async (locale, downPayment, principal) => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(withMessages(locale, <FinanceDetailsDisclosure locale={locale} listingId="abc" />));

    await userEvent.click(showButton(locale));
    await screen.findByTestId("finance-assumptions");

    expect(money(downPayment)).toBeInTheDocument();
    expect(money(principal)).toBeInTheDocument();
  });


  // A RangeError from formatMoney inside a render unmounts the whole subtree:
  // the panel and its own button vanish and the error reaches the Next.js error
  // boundary. Every money field of the quote is therefore formatted through the
  // shared guard, and an unrenderable one is dropped, not thrown.
  const MONEY_ROWS = [
    ["down_payment_amount", "finance.down_payment"],
    ["principal", "finance.amount_financed"],
    ["total_payment", "finance.total_installments"],
    ["total_interest", "finance.total_interest"],
  ] as const;

  const HOSTILE_AMOUNTS = [
    "abc",
    "1e5",
    "",
    " ",
    "1,000.00",
    "€91800.00",
    "NaN",
    null,
    undefined,
  ];

  // One case per field/value pair rather than a loop in one test: a loop of
  // nine renders trips vitest's 5s timeout on a loaded CI worker.
  const HOSTILE_CASES = MONEY_ROWS.flatMap(([field, labelKey]) =>
    HOSTILE_AMOUNTS.map((hostile) => [field, labelKey, hostile] as const),
  );

  it.each(HOSTILE_CASES)(
    "drops the %s row when the server sends %s = %s",
    async (field, labelKey, hostile) => {
      requestFinanceQuote.mockResolvedValue({ ...QUOTE, [field]: hostile });

      expect(() =>
        render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />)),
      ).not.toThrow();
      await userEvent.click(showButton());
      const rows = await screen.findByTestId("finance-assumptions");

      expect(screen.queryByText(testT("en")(labelKey))).not.toBeInTheDocument();
      expect(within(rows).getByText("48 months")).toBeInTheDocument();
      expect(within(rows).getByText("5.0000%")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Hide assumptions" })).toBeInTheDocument();
      expect(
        screen.getByText(testT("en")("finance.illustrative_disclaimer")),
      ).toBeInTheDocument();
    },
  );

  it.each(["eu", "€", "", " ", "EURO", "E1R", null, undefined])(
    "shows the unavailable state rather than a half-empty panel for currency %s",
    async (currency) => {
      requestFinanceQuote.mockResolvedValue({ ...QUOTE, currency });

      expect(() =>
        render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />)),
      ).not.toThrow();
      await userEvent.click(showButton());

      await waitFor(() =>
        expect(
          screen.getByText("The estimate could not be calculated right now."),
        ).toBeInTheDocument(),
      );
      expect(screen.queryByTestId("finance-assumptions")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Hide assumptions" })).toBeInTheDocument();
    },
  );

  it.each(["abc", "", null, undefined, "8,456.36", "1e5"])(
    "shows the unavailable state when the headline monthly payment is %s",
    async (monthly) => {
      requestFinanceQuote.mockResolvedValue({ ...QUOTE, monthly_payment: monthly });

      expect(() =>
        render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />)),
      ).not.toThrow();
      await userEvent.click(showButton());

      await waitFor(() =>
        expect(
          screen.getByText("The estimate could not be calculated right now."),
        ).toBeInTheDocument(),
      );
      expect(screen.queryByTestId("finance-assumptions")).not.toBeInTheDocument();
    },
  );

  it.each(LOCALES)("translates that unavailable state too (%s)", async (locale) => {
    requestFinanceQuote.mockResolvedValue({ ...QUOTE, currency: "€" });
    render(withMessages(locale, <FinanceDetailsDisclosure locale={locale} listingId="abc" />));

    await userEvent.click(showButton(locale));

    await waitFor(() =>
      expect(screen.getByText(testT(locale)("finance.details.error"))).toBeInTheDocument(),
    );
  });

  // The in-flight guard: a reader who opens, closes and opens again before the
  // first POST answers must not send a second one (spec 11.6 logs an explicit
  // calculator interaction; two rows for one intent is a wrong metric and a
  // doubled 429 risk).
  it("never sends a second request while the first is still in flight", async () => {
    let settle!: (quote: FinanceQuote) => void;
    requestFinanceQuote.mockReturnValue(
      new Promise<FinanceQuote>((resolve) => {
        settle = resolve;
      }),
    );
    render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />));

    await userEvent.click(showButton());
    await userEvent.click(screen.getByRole("button", { name: "Hide assumptions" }));
    await userEvent.click(showButton());
    await userEvent.click(screen.getByRole("button", { name: "Hide assumptions" }));
    await userEvent.click(showButton());

    expect(requestFinanceQuote).toHaveBeenCalledTimes(1);

    await act(async () => {
      settle(QUOTE);
    });
    await waitFor(() => expect(screen.getByTestId("finance-assumptions")).toBeInTheDocument());
    expect(requestFinanceQuote).toHaveBeenCalledTimes(1);
  });

  it("does not touch state after it is unmounted mid-request", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let settle!: (quote: FinanceQuote) => void;
    requestFinanceQuote.mockReturnValue(
      new Promise<FinanceQuote>((resolve) => {
        settle = resolve;
      }),
    );
    const view = render(withMessages("en", <FinanceDetailsDisclosure locale="en" listingId="abc" />));

    await userEvent.click(showButton());
    view.unmount();

    await act(async () => {
      settle(QUOTE);
    });

    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("asks for the listing it was given, not a hard-coded one", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(
      <FinanceDetailsDisclosure
        locale="en"
        listingId="7c9e6679-7425-40de-944b-e07fc1f90ae7"
      />,
    );

    await userEvent.click(showButton());

    await waitFor(() =>
      expect(requestFinanceQuote).toHaveBeenCalledWith({
        listing_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      }),
    );
  });
});

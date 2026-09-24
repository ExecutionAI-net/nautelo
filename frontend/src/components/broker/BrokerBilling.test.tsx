import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BrokerBilling from "@/components/broker/BrokerBilling";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), apiFetch }));
vi.mock("@/components/team/ManageBillingButton", () => ({ default: () => null }));

const billing = (status: string) => ({
  broker_status: "ACTIVE",
  status,
  current_period_end: null,
  trial_ends_at: "2026-10-24T09:00:00Z",
  trial_available: false,
  trial_days: 30,
  past_due_since: null,
  plan: { name: "Broker", monthly_price: "99.00", currency: "EUR" },
});

describe("BrokerBilling", () => {
  it("confirms the checkout the broker just came back from", async () => {
    window.history.replaceState(null, "", "/dashboard/broker/subscription/?checkout=success");
    apiFetch.mockResolvedValue(billing("TRIALING"));

    render(<BrokerBilling brokerId="b1" />);

    expect(await screen.findByRole("status")).toHaveTextContent("Thank you. Your subscription is set up");
    expect(window.location.search).toBe("");
  });

  it("says a cancelled checkout charged nothing", async () => {
    window.history.replaceState(null, "", "/dashboard/broker/subscription/?checkout=cancelled");
    apiFetch.mockResolvedValue(billing("INACTIVE"));

    render(<BrokerBilling brokerId="b1" />);

    expect(await screen.findByRole("status")).toHaveTextContent("Checkout cancelled. Nothing was charged.");
  });

  it("shows no checkout message on an ordinary visit", async () => {
    window.history.replaceState(null, "", "/dashboard/broker/subscription/");
    apiFetch.mockResolvedValue(billing("ACTIVE"));

    render(<BrokerBilling brokerId="b1" />);

    expect(await screen.findByText("Active")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

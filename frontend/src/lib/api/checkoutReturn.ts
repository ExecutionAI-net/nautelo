"use client";

import { useEffect, useState } from "react";

export type CheckoutOutcome = "success" | "cancelled";

/**
 * Stripe sends the buyer back to the page they started from with
 * `?checkout=success|cancelled` (brokers/billing.py, professionals/billing.py,
 * payments/checkout.py). This reads the flag once, removes it from the address
 * bar so a reload does not repeat the message, and returns the outcome.
 */
export function useCheckoutReturn(): CheckoutOutcome | null {
  const [outcome, setOutcome] = useState<CheckoutOutcome | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("checkout");
    if (value !== "success" && value !== "cancelled") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the return flag once
    setOutcome(value);
    params.delete("checkout");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  return outcome;
}

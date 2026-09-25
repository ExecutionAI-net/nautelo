import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useCheckoutReturn } from "@/lib/api/checkoutReturn";

describe("useCheckoutReturn", () => {
  it("reads Stripe's return flag once and strips it from the address bar", () => {
    window.history.replaceState(null, "", "/dashboard/broker/subscription/?checkout=success&tab=plan");

    const { result } = renderHook(() => useCheckoutReturn());

    expect(result.current).toBe("success");
    expect(window.location.search).toBe("?tab=plan");
  });

  it("reports a cancelled checkout", () => {
    window.history.replaceState(null, "", "/dashboard/service-provider/membership/?checkout=cancelled");

    const { result } = renderHook(() => useCheckoutReturn());

    expect(result.current).toBe("cancelled");
    expect(window.location.search).toBe("");
  });

  it("stays quiet on an ordinary visit or an unknown value", () => {
    window.history.replaceState(null, "", "/dashboard/broker/subscription/");
    expect(renderHook(() => useCheckoutReturn()).result.current).toBeNull();

    window.history.replaceState(null, "", "/dashboard/broker/subscription/?checkout=maybe");
    expect(renderHook(() => useCheckoutReturn()).result.current).toBeNull();
    expect(window.location.search).toBe("?checkout=maybe");
  });
});

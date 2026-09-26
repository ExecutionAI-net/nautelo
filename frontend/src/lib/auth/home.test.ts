import { describe, expect, it } from "vitest";

import { accountHrefFor, businessAreaFor, isBrokerAccount } from "./home";

describe("accountHrefFor", () => {
  it("keeps a broker inside the brokerage area", () => {
    expect(accountHrefFor({ primary_role: "BROKER" })).toBe("/dashboard/broker/account/");
    expect(accountHrefFor({ primary_role: "PROFESSIONAL" })).toBe("/dashboard/service-provider/account/");
    expect(accountHrefFor({ primary_role: "PRIVATE_SELLER" })).toBe("/dashboard/private-seller/account/");
  });
});

describe("isBrokerAccount", () => {
  it("is true for the broker role or any broker seat", () => {
    expect(isBrokerAccount({ user: { primary_role: "BROKER" }, broker_memberships: [] })).toBe(true);
    expect(isBrokerAccount({ user: { primary_role: "PRIVATE_SELLER" }, broker_memberships: [{}] })).toBe(true);
    expect(isBrokerAccount({ user: { primary_role: "PROFESSIONAL" }, broker_memberships: [] })).toBe(false);
    expect(isBrokerAccount(null)).toBe(false);
  });
});

describe("businessAreaFor", () => {
  it("names the business area, or null for a private seller", () => {
    expect(businessAreaFor({ user: { primary_role: "BROKER" }, broker_memberships: [] })).toBe("broker");
    expect(businessAreaFor({ user: { primary_role: "PROFESSIONAL" }, broker_memberships: [] })).toBe("provider");
    expect(businessAreaFor({ user: { primary_role: "PRIVATE_SELLER" }, broker_memberships: [] })).toBeNull();
    expect(businessAreaFor(null)).toBeNull();
  });
});

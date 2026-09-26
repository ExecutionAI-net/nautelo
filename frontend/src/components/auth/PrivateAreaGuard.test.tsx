import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PrivateAreaGuard, { brokerPathFor } from "./PrivateAreaGuard";

const replaceMock = vi.fn();
let pathname = "/dashboard/private-seller/";
let session: unknown = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => pathname,
}));
vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session, loading: false }) }));

const ID = "0b5c3f6e-1d2a-4c3b-9e8f-7a6b5c4d3e2f";

beforeEach(() => {
  replaceMock.mockReset();
  pathname = "/dashboard/private-seller/";
  session = null;
});

describe("brokerPathFor", () => {
  it("sends each private seller page to its brokerage counterpart", () => {
    expect(brokerPathFor("/dashboard/private-seller/")).toBe("/dashboard/broker/");
    expect(brokerPathFor("/dashboard/private-seller/listings/")).toBe("/dashboard/broker/fleet/");
    expect(brokerPathFor("/sell/create/")).toBe("/dashboard/broker/fleet/");
    expect(brokerPathFor(`/sell/${ID}/`)).toBe(`/dashboard/broker/fleet/${ID}/`);
    expect(brokerPathFor("/dashboard/private-seller/account/")).toBe("/dashboard/broker/account/");
    expect(brokerPathFor("/dashboard/private-seller/notifications/")).toBe("/dashboard/broker/notifications/");
    expect(brokerPathFor("/dashboard/private-seller/messages/")).toBe("/dashboard/broker/messages/");
    expect(brokerPathFor(`/dashboard/private-seller/messages/${ID}/`)).toBe(`/dashboard/broker/messages/${ID}/`);
  });
});

describe("PrivateAreaGuard", () => {
  it("redirects a broker account and never shows the private page", () => {
    session = { authenticated: true, user: { primary_role: "BROKER" }, broker_memberships: [] };
    pathname = `/sell/${ID}/`;
    render(<PrivateAreaGuard>private content</PrivateAreaGuard>);
    expect(screen.queryByText("private content")).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith(`/dashboard/broker/fleet/${ID}/`);
  });

  it("also treats an account holding a broker seat as a broker", () => {
    session = { authenticated: true, user: { primary_role: "PRIVATE_SELLER" }, broker_memberships: [{ broker_id: "b" }] };
    render(<PrivateAreaGuard>private content</PrivateAreaGuard>);
    expect(replaceMock).toHaveBeenCalledWith("/dashboard/broker/");
  });

  it.each(["PRIVATE_SELLER", "PROFESSIONAL"])("lets a %s account through", (role) => {
    session = { authenticated: true, user: { primary_role: role }, broker_memberships: [] };
    render(<PrivateAreaGuard>private content</PrivateAreaGuard>);
    expect(screen.getByText("private content")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

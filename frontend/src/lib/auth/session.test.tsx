import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/lib/api/client";
import { SessionProvider, useSession } from "@/lib/auth/session";
import type { PermissionMap, SessionPayload } from "@/lib/auth/types";

const ALL_FALSE: PermissionMap = {
  browse_public_content: true,
  submit_inquiry: false,
  reveal_contact_after_inquiry: false,
  reveal_any_contact: false,
  create_private_listing: false,
  create_broker_listing: false,
  create_listing_on_behalf: false,
  enable_listing_finance_flag: false,
  approve_listings_and_revisions: false,
  configure_broker_auto_approval: false,
  configure_products_and_settings: false,
  manage_taxonomy: false,
};

function payload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    authenticated: false,
    user: null,
    locale: "EN",
    permissions: ALL_FALSE,
    broker_memberships: [],
    professional_profile: null,
    staff: { is_staff_moderator: false, is_staff_admin: false },
    ...overrides,
  };
}

function Probe() {
  const { session, loading, can } = useSession();
  if (loading) return <p>loading</p>;
  return (
    <div>
      <span data-testid="email">{session?.user?.email ?? "guest"}</span>
      <span data-testid="can-sell">
        {String(can("create_private_listing"))}
      </span>
    </div>
  );
}

afterEach(() => {
  // The access token is module state in the API client; reset it between tests.
  setAccessToken(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockSession(body: SessionPayload, { refreshOk = false } = {}) {
  // The provider tries the refresh endpoint first, then the session endpoint.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/token/refresh/")) {
        return refreshOk
          ? new Response(JSON.stringify({ access: "test-access-token" }), {
              status: 200,
            })
          : new Response(
              JSON.stringify({ error: { code: "token_not_valid" } }),
              { status: 401 },
            );
      }
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

describe("SessionProvider", () => {
  it("exposes the guest session", async () => {
    mockSession(payload());
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent("guest"),
    );
    expect(screen.getByTestId("can-sell")).toHaveTextContent("false");
  });

  it("restores an authenticated session from the refresh cookie on reload", async () => {
    mockSession(
      payload({
        authenticated: true,
        user: {
          id: "11111111-1111-1111-1111-111111111111",
          email: "seller@example.com",
          full_name: "Sea Seller",
          primary_role: "PRIVATE_SELLER",
          locale: "EN",
          email_verified: true,
          is_active: true,
        },
        permissions: { ...ALL_FALSE, create_private_listing: true },
      }),
      { refreshOk: true },
    );
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent(
        "seller@example.com",
      ),
    );
    expect(screen.getByTestId("can-sell")).toHaveTextContent("true");
  });

  it("falls back to a guest session when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent("guest"),
    );
  });
});

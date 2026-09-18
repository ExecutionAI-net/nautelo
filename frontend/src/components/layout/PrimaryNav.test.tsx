import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PrimaryNav from "@/components/layout/PrimaryNav";
import type { PermissionMap, SessionPayload } from "@/lib/auth/types";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({
  useSession: () => useSessionMock(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

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

function mockSession(permissions: PermissionMap, authenticated = true) {
  const value: SessionPayload = {
    authenticated,
    user: authenticated
      ? {
          id: "1",
          email: "nav@example.com",
          full_name: "Nav User",
          primary_role: "BUYER",
          locale: "EN",
          email_verified: true,
          is_active: true,
        }
      : null,
    locale: "EN",
    permissions,
    broker_memberships: [],
    professional_profile: null,
    staff: { is_staff_moderator: false, is_staff_admin: false },
  };
  useSessionMock.mockReturnValue({
    session: value,
    loading: false,
    error: null,
    can: (key: keyof PermissionMap) => permissions[key] === true,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => useSessionMock.mockReset());

describe("PrimaryNav", () => {
  it("shows only public links to a guest", () => {
    mockSession(ALL_FALSE, false);
    render(<PrimaryNav />);
    expect(screen.getByRole("link", { name: "Boats" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Moderation" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("links to no page that does not exist yet", () => {
    // Every permission granted: the nav must STILL not offer /sell/ or /fleet/,
    // because Phase 11/16 have not built those pages. See the note in Step 6.
    mockSession(
      Object.fromEntries(
        Object.keys(ALL_FALSE).map((key) => [key, true]),
      ) as PermissionMap,
    );
    render(<PrimaryNav />);
    expect(screen.queryByRole("link", { name: "Sell" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fleet" })).not.toBeInTheDocument();
  });

  it("shows the moderation link only to approvers", () => {
    mockSession({ ...ALL_FALSE, approve_listings_and_revisions: true });
    render(<PrimaryNav />);
    expect(screen.getByRole("link", { name: "Moderation" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("shows the settings link only to staff admins", () => {
    mockSession({ ...ALL_FALSE, configure_products_and_settings: true });
    render(<PrimaryNav />);
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});

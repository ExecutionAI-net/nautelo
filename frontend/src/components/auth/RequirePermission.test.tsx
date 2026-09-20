import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RequirePermission from "@/components/auth/RequirePermission";
import type { PermissionMap, SessionPayload } from "@/lib/auth/types";

// vi.mock factories are hoisted above the module body, so anything they close
// over must be created with vi.hoisted() or it is still in the temporal dead
// zone when the mocked module is first imported.
const { replace, useSessionMock } = vi.hoisted(() => ({
  replace: vi.fn(),
  useSessionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/dashboard/private-seller/",
}));

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

function session(overrides: Partial<SessionPayload> = {}): SessionPayload {
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

function mockSession(value: SessionPayload | null, loading = false) {
  useSessionMock.mockReturnValue({
    session: value,
    loading,
    error: null,
    can: (key: keyof PermissionMap) => value?.permissions?.[key] === true,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => {
  replace.mockClear();
  useSessionMock.mockReset();
});

describe("RequirePermission", () => {
  it("renders nothing decisive while the session is loading", () => {
    mockSession(null, true);
    render(
      <RequirePermission permission="create_private_listing">
        <p>secret</p>
      </RequirePermission>,
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects a guest to login with a safe next url", async () => {
    mockSession(session());
    render(
      <RequirePermission permission="create_private_listing">
        <p>secret</p>
      </RequirePermission>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/login?next=%2Fdashboard%2Fprivate-seller%2F",
      ),
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("shows the 403 screen to a signed-in user without the permission", () => {
    mockSession(
      session({
        authenticated: true,
        user: {
          id: "1",
          email: "buyer@example.com",
          full_name: "",
          primary_role: "PRIVATE_SELLER",
          locale: "EN",
          email_verified: true,
          is_active: true,
        },
      }),
    );
    render(
      <RequirePermission permission="create_private_listing">
        <p>secret</p>
      </RequirePermission>,
    );
    expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders children when the permission is granted", () => {
    mockSession(
      session({
        authenticated: true,
        user: {
          id: "1",
          email: "seller@example.com",
          full_name: "",
          primary_role: "PRIVATE_SELLER",
          locale: "EN",
          email_verified: true,
          is_active: true,
        },
        permissions: { ...ALL_FALSE, create_private_listing: true },
      }),
    );
    render(
      <RequirePermission permission="create_private_listing">
        <p>secret</p>
      </RequirePermission>,
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("with no permission, still redirects a guest to sign in", async () => {
    // Ruling 13: this is the shape Phase 19's dashboard routes use. The
    // expected next-url is the file's own usePathname mock value, not a Phase 19
    // path — the assertion is about the redirect, not about the route.
    mockSession(session());
    render(
      <RequirePermission>
        <p>inbox</p>
      </RequirePermission>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/login?next=%2Fdashboard%2Fprivate-seller%2F",
      ),
    );
    expect(screen.queryByText("inbox")).not.toBeInTheDocument();
  });

  it("with no permission, renders children for an authenticated user holding none", () => {
    // ALL_FALSE: the guard is "signed in", not a capability. The capability that
    // matters (can_read_messages) is enforced server-side and has no
    // PermissionKey by design — spec §5's table has no row for it.
    mockSession(
      session({
        authenticated: true,
        user: {
          id: "1",
          email: "member@example.com",
          full_name: "",
          primary_role: "BROKER",
          locale: "EN",
          email_verified: false,
          is_active: true,
        },
      }),
    );
    render(
      <RequirePermission>
        <p>inbox</p>
      </RequirePermission>,
    );
    expect(screen.getByText("inbox")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

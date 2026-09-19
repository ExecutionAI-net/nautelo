import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BrokerDashboardNav, {
  BROKER_NAV_LINKS,
  primaryBrokerMembership,
} from "@/components/broker/BrokerDashboardNav";
import type { SessionPayload } from "@/lib/auth/types";

const { useSessionMock, usePathnameMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  usePathnameMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));
vi.mock("next/navigation", () => ({ usePathname: () => usePathnameMock() }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function mockSession(loading = false) {
  useSessionMock.mockReturnValue({
    session: {
      authenticated: true,
      user: { locale: "EN" },
      broker_memberships: [],
    },
    loading,
    error: null,
    can: () => false,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => {
  useSessionMock.mockReset();
  usePathnameMock.mockReset();
});

describe("BrokerDashboardNav", () => {
  it("contains exactly Dashboard and Messages — no Services & Surveyors, ever", () => {
    // Spec 28 "Remove": Navigation item `Services & Surveyors`. This assertion
    // is the durable form of that requirement in a codebase that never had one:
    // the set is pinned, so the item cannot be added back by accident.
    expect(BROKER_NAV_LINKS.map((link) => link.href)).toEqual([
      "/dashboard/broker/",
      "/dashboard/broker/messages/",
    ]);
  });

  it("renders spec 37's broker.messages label", () => {
    mockSession();
    usePathnameMock.mockReturnValue("/dashboard/broker/");
    render(<BrokerDashboardNav locale="en" />);
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "href",
      "/dashboard/broker/messages/",
    );
  });

  it("links to no route this application has not built", () => {
    mockSession();
    usePathnameMock.mockReturnValue("/dashboard/broker/");
    render(<BrokerDashboardNav locale="en" />);
    for (const absent of ["Fleet", "Leads", "Team", "Subscription", "Services"]) {
      expect(screen.queryByRole("link", { name: absent })).not.toBeInTheDocument();
    }
  });

  it("marks the current page with aria-current", () => {
    mockSession();
    usePathnameMock.mockReturnValue("/dashboard/broker/messages/");
    render(<BrokerDashboardNav locale="en" />);
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Messages current for a thread URL underneath it too", () => {
    mockSession();
    usePathnameMock.mockReturnValue("/dashboard/broker/messages/c-1/");
    render(<BrokerDashboardNav locale="en" />);
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders Spanish copy for the es locale", () => {
    mockSession();
    usePathnameMock.mockReturnValue("/dashboard/broker/");
    render(<BrokerDashboardNav locale="es" />);
    expect(screen.getByRole("link", { name: "Mensajes" })).toBeInTheDocument();
  });
});

describe("primaryBrokerMembership", () => {
  const membership = {
    broker_id: "b-1",
    broker_name: "Phase19 Alpha Brokers",
    broker_slug: "phase19-alpha-brokers",
    broker_status: "ACTIVE" as const,
    broker_auto_approve_listings: false,
    role: "MANAGER" as const,
    can_edit_listings: false,
    can_manage_team: false,
    can_read_messages: true,
  };

  it("returns the first membership", () => {
    const session = { broker_memberships: [membership] } as unknown as SessionPayload;
    expect(primaryBrokerMembership(session)?.broker_id).toBe("b-1");
  });

  it("returns null when there is none", () => {
    expect(
      primaryBrokerMembership({ broker_memberships: [] } as unknown as SessionPayload),
    ).toBeNull();
  });

  it("returns null for a null session", () => {
    expect(primaryBrokerMembership(null)).toBeNull();
  });
});

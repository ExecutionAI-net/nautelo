import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DashboardSidebar from "@/components/layout/DashboardSidebar";

vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session: { user: { email: "a@x.test" } }, logout: vi.fn() }) }));
vi.mock("@/components/layout/LanguageSwitcher", () => ({ default: () => null }));
vi.mock("@/components/layout/NotificationBell", () => ({ default: () => null }));
vi.mock("@/lib/i18n/useLocale", () => ({ useLocale: () => "en" }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const groups = [
  { title: "Portfolio", items: [{ href: "/a/", label: "Overview" }] },
  { title: "Account", items: [{ href: "/b/", label: "My account" }] },
];

describe("DashboardSidebar", () => {
  it("links home, opens the active group and toggles others", () => {
    render(<DashboardSidebar eyebrow="Owner" groups={groups} active="/a/" />);
    expect(screen.getByRole("link", { name: /Home/ }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Overview" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "My account" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Account/ }));
    expect(screen.getByRole("link", { name: "My account" })).toBeTruthy();
  });
});

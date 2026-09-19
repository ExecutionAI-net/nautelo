import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NotificationBell from "@/components/layout/NotificationBell";

const api = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn().mockResolvedValue({}),
  markAllNotificationsRead: vi.fn().mockResolvedValue({ marked_read: 1 }),
  fetchNotificationPreferences: vi.fn().mockResolvedValue({ email_enabled: true }),
  setEmailNotifications: vi.fn().mockResolvedValue({ email_enabled: false }),
}));
vi.mock("@/lib/api/notifications", () => api);
vi.mock("@/lib/realtime/notificationSocket", () => ({ connectNotifications: () => () => {} }));
vi.mock("next/link", () => ({
  default: ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>{children}</a>
  ),
}));

const row = {
  id: "n1",
  type: "listing.approved",
  title_key: "notification.listing_approved.title",
  body_key: "notification.listing_approved.body",
  payload: {},
  target_url: "/dashboard/",
  read_at: null,
  created_at: "2026-09-19T00:00:00Z",
};

describe("NotificationBell", () => {
  it("shows the unread count, localized text and marks read", async () => {
    api.fetchNotifications.mockResolvedValue({ results: [row], unread_count: 1 });
    render(<NotificationBell locale="en" />);
    const button = await screen.findByRole("button", { name: /Notifications, 1 unread/ });
    fireEvent.click(button);
    expect(await screen.findByText("Your listing was approved")).toBeTruthy();
    fireEvent.click(screen.getByText("Your listing was approved"));
    await waitFor(() => expect(api.markNotificationRead).toHaveBeenCalledWith("n1"));
  });

  it("never follows a protocol-relative target", async () => {
    api.fetchNotifications.mockResolvedValue({
      results: [{ ...row, target_url: "//evil.test/x" }],
      unread_count: 1,
    });
    render(<NotificationBell locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: /Notifications/ }));
    await screen.findByText("Your listing was approved");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("lets the user opt out of email", async () => {
    api.fetchNotifications.mockResolvedValue({ results: [], unread_count: 0 });
    render(<NotificationBell locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: /Notifications/ }));
    const box = await screen.findByLabelText("Email me about these");
    fireEvent.click(box);
    await waitFor(() => expect(api.setEmailNotifications).toHaveBeenCalledWith(false));
  });
});

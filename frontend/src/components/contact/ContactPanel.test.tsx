import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ContactPanel from "@/components/contact/ContactPanel";
import { CONTACT_ACCESS_REFRESH_EVENT } from "@/lib/api/contacts";

const fetchContactAccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/contacts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/contacts")>()),
  fetchContactAccess,
}));

// The panel must not ask the server before SessionProvider has traded the
// HttpOnly refresh cookie for an access token, so the session is part of every
// test's setup rather than something the panel is assumed to ignore.
const sessionState = vi.hoisted(() => ({
  current: { session: null as unknown, loading: false },
}));
vi.mock("@/lib/auth/session", () => ({ useSession: () => sessionState.current }));

function signedIn(id: string) {
  return { authenticated: true, user: { id, email: `${id}@example.com` } };
}

const TARGET_ID = "0f1e2d3c-4b5a-4697-8899-aabbccddeeff";

function locked() {
  return {
    state: "LOCKED" as const,
    email_mask: "i••••@example.com",
    phone_mask: "+34 ••• ••• ••2",
    unlock_rule: "SEND_INQUIRY" as const,
  };
}

function granted() {
  return {
    state: "GRANTED" as const,
    email: "info@example.com",
    phone: "+34900111222",
    website_url: "https://example.com",
    granted_at: "2026-09-18T10:30:00Z",
  };
}

function renderPanel() {
  return render(
    <ContactPanel targetType="professional" targetId={TARGET_ID} locale="en" />,
  );
}

beforeEach(() => {
  fetchContactAccess.mockReset();
  sessionState.current = { session: null, loading: false };
});

describe("ContactPanel", () => {
  it("shows the masked values and the unlock explanation when locked", async () => {
    fetchContactAccess.mockResolvedValue(locked());

    renderPanel();

    expect(await screen.findByText("i••••@example.com")).toBeInTheDocument();
    expect(screen.getByText("+34 ••• ••• ••2")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Send a message through Nautelo to unlock business contact details.",
      ),
    ).toBeInTheDocument();
  });

  it("renders no raw contact value anywhere in the locked DOM", async () => {
    fetchContactAccess.mockResolvedValue(locked());

    const { container } = renderPanel();
    await screen.findByText("i••••@example.com");

    expect(container.innerHTML).not.toContain("info@example.com");
    expect(container.innerHTML).not.toContain("900111222");
  });

  it("puts nothing secret in an aria-label or a title attribute (spec 16)", async () => {
    fetchContactAccess.mockResolvedValue(locked());

    const { container } = renderPanel();
    await screen.findByText("i••••@example.com");

    for (const element of container.querySelectorAll("[aria-label], [title]")) {
      expect(element.getAttribute("aria-label") ?? "").not.toContain("@");
      expect(element.getAttribute("title") ?? "").not.toContain("@");
    }
  });

  it("keeps the masked values readable by a screen reader", async () => {
    // Spec 16: "screen readers hear the masked value and unlock explanation".
    // The mask must therefore NOT be aria-hidden; only the decorative lock
    // glyph is.
    fetchContactAccess.mockResolvedValue(locked());

    renderPanel();
    const mask = await screen.findByText("i••••@example.com");

    expect(mask.closest("[aria-hidden='true']")).toBeNull();
  });

  it("marks the locked values non-selectable rather than hiding them", async () => {
    fetchContactAccess.mockResolvedValue(locked());

    renderPanel();
    const mask = await screen.findByText("i••••@example.com");

    expect(mask.className).toContain("select-none");
  });

  it("renders actionable links once granted", async () => {
    fetchContactAccess.mockResolvedValue(granted());

    renderPanel();

    expect(await screen.findByRole("link", { name: "info@example.com" })).toHaveAttribute(
      "href",
      "mailto:info@example.com",
    );
    expect(screen.getByRole("link", { name: "+34900111222" })).toHaveAttribute(
      "href",
      "tel:+34900111222",
    );
    expect(screen.getByRole("link", { name: "https://example.com" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(screen.getByText("Contact details unlocked")).toBeInTheDocument();
  });

  it("renders a staff reveal, which has no grant date, without crashing", async () => {
    // Spec §5 lets a staff moderator or admin reveal without a grant, so the
    // payload's `granted_at` is null. An unguarded `.slice()` would throw here
    // and unmount the panel for every staff viewer of every profile.
    fetchContactAccess.mockResolvedValue({ ...granted(), granted_at: null });

    renderPanel();

    expect(await screen.findByRole("link", { name: "info@example.com" })).toBeInTheDocument();
    expect(screen.getByText("Contact details unlocked")).toBeInTheDocument();
    expect(screen.queryByText("Unlocked on")).not.toBeInTheDocument();
    expect(document.querySelector("time")).toBeNull();
  });

  it("omits the website row when the entity has none", async () => {
    fetchContactAccess.mockResolvedValue({ ...granted(), website_url: null });

    renderPanel();
    await screen.findByRole("link", { name: "info@example.com" });

    expect(screen.queryByText("Website")).not.toBeInTheDocument();
  });

  it("explains an unavailable profile without masks or an unlock prompt", async () => {
    fetchContactAccess.mockResolvedValue({ state: "UNAVAILABLE" as const });

    renderPanel();

    expect(
      await screen.findByText(
        "Contact details are not available for this profile right now.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Send a message through Nautelo to unlock business contact details.",
      ),
    ).not.toBeInTheDocument();
  });

  it("shows an error state instead of pretending the contact is locked", async () => {
    fetchContactAccess.mockRejectedValue(new Error("network"));

    renderPanel();

    expect(
      await screen.findByText(
        "Contact details could not be loaded. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("waits for the session to bootstrap before asking the server", async () => {
    // Regression test for a real failure mode: lib/auth/session.tsx starts with
    // `loading: true` and the in-memory access token empty. A request sent then
    // is anonymous, and this endpoint answers 200 LOCKED to an anonymous
    // caller — so apiFetch's 401-refresh-retry never fires and a grant holder
    // would be shown LOCKED until they reloaded the page.
    sessionState.current = { session: null, loading: true };
    fetchContactAccess.mockResolvedValue(granted());

    const { rerender } = renderPanel();

    expect(fetchContactAccess).not.toHaveBeenCalled();

    sessionState.current = { session: signedIn("viewer-1"), loading: false };
    rerender(
      <ContactPanel targetType="professional" targetId={TARGET_ID} locale="en" />,
    );

    expect(await screen.findByRole("link", { name: "info@example.com" })).toBeInTheDocument();
    await waitFor(() => expect(fetchContactAccess).toHaveBeenCalledTimes(1));
  });

  it("re-asks when the viewer identity changes", async () => {
    // Logging in without a full page load must not leave a stale LOCKED panel.
    sessionState.current = { session: null, loading: false };
    fetchContactAccess.mockResolvedValueOnce(locked()).mockResolvedValueOnce(granted());

    const { rerender } = renderPanel();
    await screen.findByText("i••••@example.com");

    sessionState.current = { session: signedIn("viewer-2"), loading: false };
    rerender(
      <ContactPanel targetType="professional" targetId={TARGET_ID} locale="en" />,
    );

    expect(await screen.findByRole("link", { name: "info@example.com" })).toBeInTheDocument();
  });

  it("refetches when an inquiry for this target reports success", async () => {
    // Spec 16: "After successful send, refetch contact authorization; do not
    // rely on client-side unblur alone."
    fetchContactAccess.mockResolvedValueOnce(locked()).mockResolvedValueOnce(granted());

    renderPanel();
    await screen.findByText("i••••@example.com");

    window.dispatchEvent(
      new CustomEvent(CONTACT_ACCESS_REFRESH_EVENT, {
        detail: { targetType: "professional", targetId: TARGET_ID },
      }),
    );

    expect(await screen.findByRole("link", { name: "info@example.com" })).toBeInTheDocument();
  });

  it("ignores a refresh event for a different target", async () => {
    fetchContactAccess.mockResolvedValue(locked());

    renderPanel();
    await screen.findByText("i••••@example.com");

    window.dispatchEvent(
      new CustomEvent(CONTACT_ACCESS_REFRESH_EVENT, {
        detail: { targetType: "broker", targetId: "someone-else" },
      }),
    );

    await waitFor(() => expect(fetchContactAccess).toHaveBeenCalledTimes(1));
  });
});

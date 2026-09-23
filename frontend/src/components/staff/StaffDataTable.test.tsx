import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import StaffDataTable, { cell, humanize } from "@/components/staff/StaffDataTable";

const api = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api/client", () => api);

const PAGE = {
  count: 1,
  next: null,
  previous: null,
  facets: { PENDING_APPROVAL: 1, PUBLISHED: 0 },
  results: [{ id: "b1", title: "2015 Fairline Targa 34", status: "PENDING_APPROVAL", seller_type: "PRIVATE_SELLER", created_at: "2026-09-23T10:15:00Z", slug: "targa-34" }],
};

describe("StaffDataTable", () => {
  it("turns enum codes and timestamps into readable text", () => {
    expect(humanize("PENDING_APPROVAL")).toBe("Pending approval");
    expect(humanize("PAID")).toBe("Paid");
    expect(humanize("EUR")).toBe("EUR");
    expect(humanize("Adriatic Yacht Group")).toBe("Adriatic Yacht Group");
    expect(cell("2026-09-23T10:15:00Z")).toBe("23 Sept 2026");
    expect(cell("2026-09-23T10:15:00Z", true)).toMatch(/23 Sept 2026, \d{2}:\d{2}/);
    expect(cell(true)).toBe("Yes");
    expect(cell(null)).toBe("-");
  });

  it("sorts through the ordering parameter and keeps panel-only columns out of the table", async () => {
    api.apiFetch.mockResolvedValue(PAGE);
    render(
      <StaffDataTable
        title="Boats"
        eyebrow="Staff / Boats"
        endpoint="/api/v1/staff/boats/"
        columns={[
          { key: "title", label: "Listing" },
          { key: "status", label: "Status" },
          { key: "created_at", label: "Created", sortable: true },
          { key: "slug", label: "Slug", panelOnly: true },
        ]}
        statusOptions={["PENDING_APPROVAL", "PUBLISHED"]}
        publicLink={{ key: "slug", base: "/boats/", label: "Open public page", when: (row) => row.status === "PUBLISHED" }}
      />,
    );
    expect((await screen.findAllByText("Pending approval")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("columnheader", { name: /Slug/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Created/ }));
    await waitFor(() => expect(api.apiFetch).toHaveBeenLastCalledWith(expect.stringContaining("ordering=created_at")));
    fireEvent.click(screen.getByRole("button", { name: /Created/ }));
    await waitFor(() => expect(api.apiFetch).toHaveBeenLastCalledWith(expect.stringContaining("ordering=-created_at")));
    // The details panel shows every column, including the panel-only one, and no public link while unpublished.
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByText("targa-34")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open public page/ })).toBeNull();
  });

  it("asks before suspending an account", async () => {
    api.apiFetch.mockResolvedValue({ ...PAGE, results: [{ id: "u1", full_name: "Ana Ruiz", email: "ana@example.org", is_active: true }] });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <StaffDataTable
        title="Users"
        eyebrow="Staff / Users"
        endpoint="/api/v1/staff/users/"
        statusActionsBase="/api/v1/staff/users/"
        columns={[
          { key: "full_name", label: "User" },
          { key: "email", label: "Email" },
          { key: "is_active", label: "Active" },
        ]}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "View details" }));
    fireEvent.click(screen.getByRole("button", { name: /Suspend/ }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Suspend Ana Ruiz?"));
    expect(api.apiFetch).toHaveBeenCalledTimes(1);
  });
});

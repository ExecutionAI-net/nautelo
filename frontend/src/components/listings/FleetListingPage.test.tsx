import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FleetListingPage from "@/components/listings/FleetListingPage";

const session = vi.hoisted(() => ({ value: { broker_memberships: [] as unknown[] } }));
vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session: session.value }) }));
const form = vi.hoisted(() => vi.fn((props: { brokerId?: string }) => <div>{props.brokerId}</div>));
vi.mock("@/components/listings/SellListingForm", () => ({ default: form }));

describe("FleetListingPage", () => {
  it("binds the form to the first broker the viewer may edit", () => {
    session.value = {
      broker_memberships: [
        { broker_id: "b0", broker_name: "RO", can_edit_listings: false },
        { broker_id: "b1", broker_name: "Acme", can_edit_listings: true },
      ],
    };
    render(<FleetListingPage />);
    expect(form.mock.calls[0][0]).toMatchObject({ brokerId: "b1" });
  });

  it("explains when no broker allows editing", () => {
    session.value = { broker_memberships: [] };
    render(<FleetListingPage />);
    expect(screen.getByRole("status").textContent).toMatch(/do not have permission/);
  });
});

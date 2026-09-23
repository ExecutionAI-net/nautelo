import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import CompareToggle from "@/components/listings/CompareToggle";
import { COMPARE_STORAGE_KEY } from "@/lib/compare";

const LABELS = {
  add: "Add to compare",
  added: "Added",
  remove: "Remove from compare",
  open: "Compare {count} boats",
  full: "Full",
};
const ID = "3f1d2c4e-0000-4000-8000-00000000000a";

describe("CompareToggle", () => {
  beforeEach(() => window.localStorage.clear());

  it("adds and removes the listing from the browser shortlist and links to the compare page", () => {
    render(<CompareToggle listingId={ID} labels={LABELS} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to compare" }));
    expect(window.localStorage.getItem(COMPARE_STORAGE_KEY)).toBe(ID);
    expect(screen.getByRole("link", { name: "Compare 1 boats" }).getAttribute("href")).toContain(`ids=${ID}`);
    fireEvent.click(screen.getByRole("button", { name: "Remove from compare" }));
    expect(window.localStorage.getItem(COMPARE_STORAGE_KEY)).toBe("");
  });

  it("refuses a fifth boat", () => {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      ["1", "2", "3", "4"].map((n) => `3f1d2c4e-0000-4000-8000-00000000000${n}`).join(","),
    );
    render(<CompareToggle listingId={ID} labels={LABELS} />);
    expect((screen.getByRole("button", { name: "Full" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

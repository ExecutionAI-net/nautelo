import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ShareButtons from "@/components/listings/ShareButtons";

describe("ShareButtons", () => {
  it("shares only the canonical URL on WhatsApp", () => {
    render(<ShareButtons url="https://x.test/boats/a-1/" locale="en" />);
    const link = screen.getByRole("link", { name: "Share on WhatsApp" });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/?text=${encodeURIComponent("https://x.test/boats/a-1/")}`,
    );
  });

  it("copies the link and announces it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ShareButtons url="https://x.test/boats/a-1/" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByText("Link copied")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith("https://x.test/boats/a-1/");
  });
});

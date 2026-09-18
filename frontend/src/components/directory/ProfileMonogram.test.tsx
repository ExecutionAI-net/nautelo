import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProfileMonogram from "@/components/directory/ProfileMonogram";

describe("ProfileMonogram", () => {
  it("uses the first letters of the first two words", () => {
    render(<ProfileMonogram name="Ocean Legal" />);

    expect(screen.getByText("OL")).toBeInTheDocument();
  });

  it("falls back to a single letter for a one-word name", () => {
    render(<ProfileMonogram name="Nauticare" />);

    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("is decorative and hidden from assistive technology", () => {
    const { container } = render(<ProfileMonogram name="Ocean Legal" />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("renders nothing meaningful for an empty name rather than crashing", () => {
    render(<ProfileMonogram name="   " />);

    expect(screen.getByTestId("profile-monogram").textContent).toBe("");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LanguageSwitcher from "@/components/layout/LanguageSwitcher";

vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session: null }) }));

describe("LanguageSwitcher", () => {
  afterEach(() => {
    document.cookie = "nauta_locale=; path=/; max-age=0";
  });

  it("marks the current language, remembers the choice and opens the same page in that language", () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { pathname: "/boats/", search: "?brand=Azimut", hash: "", assign },
      writable: true,
    });
    render(<LanguageSwitcher />);
    expect(screen.getByRole("button", { name: "en" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "it" }));
    expect(document.cookie).toContain("nauta_locale=it");
    expect(assign).toHaveBeenCalledWith("/it/boats/?brand=Azimut");
  });

  it("goes from a prefixed page back to the plain English address", () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { pathname: "/es/guides/", search: "", hash: "", assign },
      writable: true,
    });
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "en" }));
    expect(assign).toHaveBeenCalledWith("/guides/");
  });
});

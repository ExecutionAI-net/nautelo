import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LanguageSwitcher from "@/components/layout/LanguageSwitcher";

vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session: null }) }));

describe("LanguageSwitcher", () => {
  afterEach(() => {
    document.cookie = "nauta_locale=; path=/; max-age=0";
  });

  it("marks the current language and stores the chosen one in a cookie", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, reload }, writable: true });
    render(<LanguageSwitcher />);
    expect(screen.getByRole("button", { name: "en" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "it" }));
    expect(document.cookie).toContain("nauta_locale=it");
    expect(reload).toHaveBeenCalled();
  });
});

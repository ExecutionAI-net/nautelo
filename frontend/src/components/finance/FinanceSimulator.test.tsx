import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api/client", () => api);
vi.mock("@/lib/i18n/useLocale", () => ({ useLocale: () => "en" }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import FinanceSimulator from "@/components/finance/FinanceSimulator";

const base = {
  country_code: "ES", condition: "ANY", use: "ANY", tae_percent: 6.7, opening_fee_percent: 0, min_price: 15000, max_price: 2000000,
  min_down_percent: 10, max_down_percent: 50, default_down_percent: 20, terms_years: [5, 7, 10, 15], max_age_at_end_years: null,
  vat_recoverable: false, representative_months: 120, note: { en: "A loan instalment carries no VAT.", it: "", es: "" },
};
const RULES = [
  { ...base, id: 1, product: "LOAN", tin_percent: 6.5, residual_percent: 0, age_plus_term_limit: 35, vat_percent: null, vat_on_installment: false },
  { ...base, id: 2, product: "LEASING", tin_percent: 5.5, residual_percent: 5, age_plus_term_limit: 35, vat_percent: 21, vat_on_installment: true, note: { en: "Leasing carries VAT.", it: "", es: "" } },
];

function setup() {
  api.apiFetch.mockImplementation((path: string) =>
    Promise.resolve(path.includes("simulator-config") ? { rules: RULES } : { count: 12 }),
  );
  return render(<FinanceSimulator />);
}

describe("FinanceSimulator", () => {
  it("answers instantly from the rulebook: 180,000 EUR, 20% down, 10 years at 6.5% is about 1,635 a month", async () => {
    setup();
    await screen.findByText("Estimated monthly payment");
    expect(screen.getByText(/1,635/)).toBeTruthy();
    expect(screen.getByText("A loan instalment carries no VAT.")).toBeTruthy();
    expect(api.apiFetch).toHaveBeenCalledTimes(1); // only the rulebook; moving a slider never calls the server
    fireEvent.change(screen.getByLabelText("Down payment"), { target: { value: "30" } });
    expect(api.apiFetch).toHaveBeenCalledTimes(1);
  });

  it("switches to leasing and shows the VAT it carries", async () => {
    setup();
    await screen.findByText("Estimated monthly payment");
    fireEvent.click(screen.getByRole("button", { name: "Leasing" }));
    expect(screen.getByText("Leasing carries VAT.")).toBeTruthy();
    expect(screen.getByText(/with VAT/)).toBeTruthy();
  });

  it("limits the term for an old used boat and says why", async () => {
    setup();
    await screen.findByText("Estimated monthly payment");
    fireEvent.click(screen.getByText("More options"));
    fireEvent.click(screen.getByRole("button", { name: "Used" }));
    fireEvent.change(screen.getByLabelText("Year of the boat"), { target: { value: String(new Date().getFullYear() - 26) } });
    expect((screen.getByRole("button", { name: "15 years" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "7 years" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/age rule/)).toBeTruthy();
  });

  it("turns a monthly budget into boats to browse", async () => {
    setup();
    await screen.findByText("Estimated monthly payment");
    fireEvent.click(screen.getByRole("button", { name: "I have a monthly budget" }));
    expect(screen.getByText("With this budget you could look at boats up to")).toBeTruthy();
    const link = screen.getByRole("link", { name: "See boats in this budget" });
    expect(link.getAttribute("href")).toMatch(/^\/boats\/\?price_max=\d+$/);
    await waitFor(() => expect(screen.getByText(/12 boats listed/)).toBeTruthy());
  });

  it("hands the numbers to the study request", async () => {
    setup();
    await screen.findByText("Estimated monthly payment");
    const href = screen.getByRole("link", { name: "Ask for a financing study" }).getAttribute("href") ?? "";
    expect(href).toContain("/financing/?");
    expect(href).toContain("price=180000");
    expect(href).toContain("term=10");
    expect(href.endsWith("#study")).toBe(true);
  });
});

import { testT } from "@/i18n/testing";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BoatCard from "@/components/listings/BoatCard";
import type { ListingFinance, ListingMedia, PublicListing } from "@/lib/api/listings";
import type { Locale } from "@/lib/i18n/directory";
import { tf } from "@/lib/i18n/finance";

// The disclosure is a client component with its own suite; the card's job is to
// mount it only for an eligible listing, which a stub proves without pulling a
// fetch into these tests.
vi.mock("@/components/listings/FinanceDetailsDisclosure", () => ({
  default: () => <div data-testid="finance-details" />,
}));

// ICU puts a no-break space (U+00A0 or U+202F, depending on the build) before
// the euro sign in it-IT / es-ES. CI runs Node 22, local may be newer, so the
// comparison normalises exactly those two characters and nothing else —
// separators, symbol placement and fraction digits stay pinned.
const norm = (value: string) => value.replace(/[  ]/g, " ");

function listing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: "3f1d2c4e-0000-4000-8000-000000000001",
    slug: "2021-beneteau-oceanis-3f1d2c4e",
    broker: null,
    seller_type: "BROKER",
    snapshot_version: 1,
    published_at: "2026-09-18T08:00:00Z",
    expires_at: null,
    brand_name: "Beneteau",
    model_name: "Oceanis 46.1",
    custom_model_name: "",
    manufacture_year: 2021,
    title: { en: "Oceanis 46.1", it: "", es: "" },
    description: { en: "", it: "", es: "" },
    specifications: {},
    specifications_schema_version: 1,
    location: { country: "ES", region: "Illes Balears", city: "Palma" },
    price: { amount: "459000.00", currency: "EUR" },
    media: [],
    view_count: 149,
    finance: { visible: false },
    ...overrides,
  };
}

function media(overrides: Partial<ListingMedia> = {}): ListingMedia {
  return {
    media_id: "9c1d2c4e-0000-4000-8000-0000000000aa",
    media_type: "IMAGE",
    storage_key: "listings/3f1d/primary.jpg",
    mime_type: "image/jpeg",
    sort_order: 0,
    width: 1600,
    height: 1200,
    duration_seconds: null,
    checksum_sha256: "a".repeat(64),
    ...overrides,
  };
}

const ELIGIBLE = {
  visible: true as const,
  monthly_payment: "8456.36",
  annual_rate_percent: "5.0000",
  term_months: 48,
  down_payment_percent: "20.0000",
  configuration_version: 1,
};

const LOCALES: readonly Locale[] = ["en", "it", "es"];

// The card carries no disclaimer paragraph of its own (one footnote per region,
// Task 9); these tests supply that region so the asterisk and the estimate's
// aria-describedby resolve exactly as they will on the page.
function renderInRegion(
  locale: Locale,
  value: PublicListing,
  disclaimerId = "finance-disclaimer",
) {
  return render(
    <div>
      <BoatCard t={testT(locale)} locale={locale} listing={value} disclaimerId={disclaimerId} />
      <p id={disclaimerId}>{tf(locale, "finance.illustrative_disclaimer")}</p>
    </div>,
  );
}

describe("BoatCard", () => {
  it("compacts the visible view count above 9,999 but keeps the exact value in the label", () => {
    render(<BoatCard t={testT("en")} locale="en" listing={listing({ view_count: 12345 })} disclaimerId="d" />);

    expect(screen.getByRole("img", { name: "12,345 views" })).toBeInTheDocument();
    expect(screen.queryByText("12,345")).not.toBeInTheDocument();
    expect(screen.getByText(/^12\.?\d*K$/i)).toBeInTheDocument();
  });

  it("does not compact at exactly 9,999", () => {
    render(<BoatCard t={testT("en")} locale="en" listing={listing({ view_count: 9999 })} disclaimerId="d" />);

    expect(screen.getByText("9,999")).toBeInTheDocument();
  });

  it("shows the price and the view count for every card", () => {
    render(<BoatCard t={testT("en")} locale="en" listing={listing()} disclaimerId="d" />);

    expect(screen.getByText("€459,000")).toBeInTheDocument();
    expect(screen.getByText("149")).toBeInTheDocument();
    expect(screen.getByLabelText("149 views")).toBeInTheDocument();
    // ARIA 1.2 forbids aria-label on a generic role (axe: aria-prohibited-attr),
    // so the icon-plus-number pair is one labelled image (spec 29.6).
    expect(screen.getByRole("img", { name: "149 views" })).toBeInTheDocument();
  });

  it("titles the card with year, brand and model", () => {
    render(<BoatCard t={testT("en")} locale="en" listing={listing()} disclaimerId="d" />);

    expect(
      screen.getByRole("heading", { name: "2021 Beneteau Oceanis 46.1" }),
    ).toBeInTheDocument();
  });

  it("uses the custom model text when the Other model was selected", () => {
    render(
      <BoatCard t={testT("en")} locale="en"
        listing={listing({ model_name: "Other", custom_model_name: "Yard One-Off 52" })}
        disclaimerId="d"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "2021 Beneteau Yard One-Off 52" }),
    ).toBeInTheDocument();
  });

  it("removes the whole finance column when the listing is not eligible", () => {
    render(<BoatCard t={testT("en")} locale="en" listing={listing()} disclaimerId="d" />);

    expect(screen.queryByText("Estimated payment")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Calculate your financing/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("finance-details")).not.toBeInTheDocument();
    expect(screen.queryByTestId("finance-estimate")).not.toBeInTheDocument();
    expect(screen.queryByText(/month/)).not.toBeInTheDocument();
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  it("shows the estimated payment when the listing is eligible", () => {
    render(
      <BoatCard t={testT("en")} locale="en" listing={listing({ finance: ELIGIBLE })} disclaimerId="d" />,
    );

    expect(screen.getByText("Estimated payment")).toBeInTheDocument();
    expect(screen.getByText("€8,456.36/month")).toBeInTheDocument();
    expect(screen.getByTestId("finance-details")).toBeInTheDocument();
  });

  it("opens the calculator in a new tab without granting opener access", () => {
    render(
      <BoatCard t={testT("en")} locale="en" listing={listing({ finance: ELIGIBLE })} disclaimerId="d" />,
    );

    const cta = screen.getByRole("link", { name: /Calculate your financing/ });
    expect(cta).toHaveAttribute(
      "href",
      "/financing/?listing=3f1d2c4e-0000-4000-8000-000000000001&price=459000.00&currency=EUR",
    );
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("builds the calculator link from this listing's own id and price", () => {
    render(
      <BoatCard t={testT("en")} locale="en"
        listing={listing({
          id: "11112222-0000-4000-8000-000000000009",
          price: { amount: "125500.50", currency: "EUR" },
          finance: ELIGIBLE,
        })}
        disclaimerId="d"
      />,
    );

    expect(screen.getByRole("link", { name: /Calculate your financing/ })).toHaveAttribute(
      "href",
      "/financing/?listing=11112222-0000-4000-8000-000000000009&price=125500.50&currency=EUR",
    );
  });

  it("resolves its disclaimer asterisk inside the region that renders it", () => {
    renderInRegion("en", listing({ finance: ELIGIBLE }));

    const asterisk = screen.getByRole("link", {
      name: tf("en", "finance.disclaimer_link"),
    });
    expect(asterisk).toHaveAttribute("href", "#finance-disclaimer");
    expect(asterisk).toHaveTextContent("*");
  });

  // WCAG 2.4.4: "*" is a mark, not a link purpose. The visible asterisk stays;
  // the announced name is the translated sentence.
  it.each(LOCALES)("names the disclaimer link something a reader can act on (%s)", (locale) => {
    renderInRegion(locale, listing({ finance: ELIGIBLE }));

    const asterisk = screen.getByRole("link", {
      name: tf(locale, "finance.disclaimer_link"),
    });
    expect(asterisk).toHaveTextContent("*");
    expect(asterisk).toHaveAttribute("href", "#finance-disclaimer");
    expect(screen.queryByRole("link", { name: "*" })).not.toBeInTheDocument();
  });

  // Spec 2.5: the disclaimer belongs to every finance result, so the estimate
  // is programmatically described by the region's one footnote — an asterisk a
  // screen reader never reaches would not satisfy it.
  it.each(LOCALES)(
    "describes the estimate with the region's mandated disclaimer (%s)",
    (locale) => {
      renderInRegion(locale, listing({ finance: ELIGIBLE }));

      const estimate = screen.getByTestId("finance-estimate");
      expect(estimate).toHaveAttribute("aria-describedby", "finance-disclaimer");
      expect(estimate).toHaveAccessibleDescription(
        tf(locale, "finance.illustrative_disclaimer"),
      );
      expect(
        screen.getByRole("link", { name: tf(locale, "finance.disclaimer_link") }),
      ).toHaveAttribute("href", "#finance-disclaimer");
    },
  );

  it.each([
    ["en" as const, "Estimated payment", "€8,456.36/month", "Calculate your financing"],
    ["it" as const, "Rata stimata", "8456,36 €/mese", "Calcola il tuo finanziamento"],
    ["es" as const, "Cuota estimada", "8456,36 €/mes", "Calcula tu financiación"],
  ])("renders every finance string in %s", (locale, label, money, cta) => {
    render(
      <BoatCard t={testT(locale)} locale={locale} listing={listing({ finance: ELIGIBLE })} disclaimerId="d" />,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText((content) => norm(content) === money)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(cta) })).toBeInTheDocument();
  });

  it.each([
    ["en" as const, "€459,000", "1,490 views"],
    ["it" as const, "459.000 €", "1490 visualizzazioni"],
    ["es" as const, "459.000 €", "1490 visualizaciones"],
  ])("localises the price and the view count in %s", (locale, price, views) => {
    render(
      <BoatCard t={testT(locale)} locale={locale} listing={listing({ view_count: 1490 })} disclaimerId="d" />,
    );

    expect(screen.getByText((content) => norm(content) === price)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: views })).toBeInTheDocument();
  });

  // formatMoney throws on anything that is not a plain decimal string. One bad
  // row must not take down the server render of a 24-card page, so the card
  // drops the value it cannot format and keeps everything else.
  it("drops the finance column when the monthly payment is not a decimal string", () => {
    const broken = { ...ELIGIBLE, monthly_payment: "8,456.36" } as ListingFinance;

    expect(() =>
      render(<BoatCard t={testT("en")} locale="en" listing={listing({ finance: broken })} disclaimerId="d" />),
    ).not.toThrow();

    expect(screen.queryByTestId("finance-estimate")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Calculate your financing/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("finance-details")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "2021 Beneteau Oceanis 46.1" }),
    ).toBeInTheDocument();
  });

  it("keeps rendering the card when the price itself cannot be formatted", () => {
    const value = listing({ price: { amount: "not-a-number", currency: "EUR" } });

    expect(() =>
      render(<BoatCard t={testT("en")} locale="en" listing={value} disclaimerId="d" />),
    ).not.toThrow();

    expect(screen.queryByText("not-a-number")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "2021 Beneteau Oceanis 46.1" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("149 views")).toBeInTheDocument();
  });

  it("keeps rendering the card when the currency code is not a currency", () => {
    const value = listing({ price: { amount: "459000.00", currency: "EURO" } });

    expect(() =>
      render(<BoatCard t={testT("en")} locale="en" listing={value} disclaimerId="d" />),
    ).not.toThrow();

    expect(
      screen.getByRole("heading", { name: "2021 Beneteau Oceanis 46.1" }),
    ).toBeInTheDocument();
  });

  // Spec 18.2: the finance column needs "listing.price is valid AND
  // listing.currency is supported". A monthly payment beside a price the card
  // could not even render is exactly the state that rule forbids.
  it.each([
    ["an unformattable price amount", { amount: "not-a-number", currency: "EUR" }],
    ["a zero price", { amount: "0.00", currency: "EUR" }],
    ["a negative price", { amount: "-459000.00", currency: "EUR" }],
    ["an unsupported currency", { amount: "459000.00", currency: "USD" }],
    ["an invalid currency code", { amount: "459000.00", currency: "EURO" }],
    ["both invalid", { amount: "", currency: "€" }],
  ])("drops the entire finance column for %s", (_label, price) => {
    expect(() =>
      render(
        <BoatCard t={testT("en")} locale="en"
          listing={listing({ price, finance: ELIGIBLE })}
          disclaimerId="finance-disclaimer"
        />,
      ),
    ).not.toThrow();

    expect(screen.queryByTestId("finance-estimate")).not.toBeInTheDocument();
    expect(screen.queryByText("Estimated payment")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Calculate your financing/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("finance-details")).not.toBeInTheDocument();
    expect(screen.queryByText("*")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "2021 Beneteau Oceanis 46.1" }),
    ).toBeInTheDocument();
  });

  it("still shows a formattable price in a currency the platform does not finance", () => {
    render(
      <BoatCard t={testT("en")} locale="en"
        listing={listing({
          price: { amount: "125500.50", currency: "USD" },
          finance: ELIGIBLE,
        })}
        disclaimerId="d"
      />,
    );

    // en-IE names a foreign currency: "US$125,500.50", not "$125,500.50".
    expect(screen.getByText((content) => norm(content) === "US$125,500.50")).toBeInTheDocument();
    expect(screen.queryByTestId("finance-estimate")).not.toBeInTheDocument();
  });

  it("treats a missing finance key as not eligible instead of throwing", () => {
    const value: Partial<PublicListing> = listing();
    delete value.finance;

    expect(() =>
      render(
        <BoatCard t={testT("en")} locale="en" listing={value as PublicListing} disclaimerId="d" />,
      ),
    ).not.toThrow();

    expect(screen.queryByTestId("finance-estimate")).not.toBeInTheDocument();
    expect(screen.queryByTestId("finance-details")).not.toBeInTheDocument();
  });

  it("treats a finance block missing its monthly payment as not eligible", () => {
    const broken = { visible: true } as unknown as ListingFinance;

    expect(() =>
      render(<BoatCard t={testT("en")} locale="en" listing={listing({ finance: broken })} disclaimerId="d" />),
    ).not.toThrow();

    expect(screen.queryByTestId("finance-estimate")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Calculate your financing/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the defined placeholder when the listing has no image", () => {
    render(
      <BoatCard t={testT("en")} locale="en"
        listing={listing({ media: [media({ media_type: "VIDEO" })] })}
        disclaimerId="d"
      />,
    );

    expect(screen.getByTestId("boat-image-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("boat-image-slot")).not.toBeInTheDocument();
  });

  it("uses the image slot when the listing carries an approved image", () => {
    render(
      <BoatCard t={testT("en")} locale="en" listing={listing({ media: [media()] })} disclaimerId="d" />,
    );

    expect(screen.getByTestId("boat-image-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("boat-image-placeholder")).not.toBeInTheDocument();
  });

  it("shows the city and region of the listing", () => {
    render(<BoatCard t={testT("en")} locale="en" listing={listing()} disclaimerId="d" />);

    expect(screen.getByText("Palma, Illes Balears")).toBeInTheDocument();
  });
});

describe("BoatCard media", () => {
  it("renders the primary image from its CDN url and falls back to the placeholder without one", () => {
    const media = {
      media_id: "m1",
      media_type: "IMAGE" as const,
      storage_key: "k",
      mime_type: "image/jpeg",
      sort_order: 0,
      width: 1,
      height: 1,
      duration_seconds: null,
      checksum_sha256: "x",
    };
    const { rerender } = render(
      <BoatCard t={testT("en")} locale="en" disclaimerId="d" listing={listing({ media: [{ ...media, url: "https://cdn.x/k" }] })} />,
    );
    expect(screen.getByTestId("boat-image").getAttribute("src")).toBe("https://cdn.x/k");
    rerender(<BoatCard t={testT("en")} locale="en" disclaimerId="d" listing={listing({ media: [{ ...media, url: null }] })} />);
    expect(screen.getByTestId("boat-image-slot")).toBeTruthy();
  });
});

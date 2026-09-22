import { testT } from "@/i18n/testing";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DirectorySearchForm from "@/components/directory/DirectorySearchForm";

const categories = [
  { slug: "legal", name: "Legal" },
  { slug: "insurance", name: "Insurance" },
];

describe("DirectorySearchForm", () => {
  it("submits as a GET to the canonical directory URL so filters stay shareable", () => {
    const { container } = render(
      <DirectorySearchForm t={testT("en")} locale="en" categories={categories} current={{}} />,
    );
    const form = container.querySelector("form")!;

    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/services/professionals/");
  });

  it("reflects the current filter values back into the controls", () => {
    render(
      <DirectorySearchForm t={testT("en")} locale="en"
        categories={categories}
        current={{ q: "survey", category: "legal", location: "Livorno", sort: "alphabetical" }}
      />,
    );

    expect(screen.getByLabelText("Search")).toHaveValue("survey");
    expect(screen.getByLabelText("Location")).toHaveValue("Livorno");
    expect(screen.getByLabelText("Category")).toHaveValue("legal");
    expect(screen.getByLabelText("Sort")).toHaveValue("alphabetical");
  });

  it("offers an all-categories option built from real records", () => {
    render(<DirectorySearchForm t={testT("en")} locale="en" categories={categories} current={{}} />);

    expect(screen.getByRole("option", { name: "All categories" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Insurance" })).toBeInTheDocument();
  });
});

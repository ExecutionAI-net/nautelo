import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SearchSelect from "@/components/forms/SearchSelect";

const OPTIONS = [
  { value: "TR", label: "Turkey" },
  { value: "US", label: "United States" },
  { value: "IT", label: "Italy" },
];

function setup(onChange = vi.fn()) {
  render(
    <SearchSelect
      label="Country"
      value=""
      options={OPTIONS}
      onChange={onChange}
      placeholder="Select"
      searchPlaceholder="Search"
      emptyText="No results"
    />,
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Country" }));
  return onChange;
}

describe("SearchSelect", () => {
  it("puts a search box above the options and filters as you type", () => {
    setup();
    const search = screen.getByRole("searchbox", { name: "Search" });
    const list = screen.getByRole("listbox");
    expect(search.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(3);
    fireEvent.change(search, { target: { value: "ital" } });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Italy"]);
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("No results")).toBeTruthy();
  });

  it("selects an option by click and by Enter on the first match", () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole("option", { name: "Turkey" }));
    expect(onChange).toHaveBeenCalledWith("TR");
    fireEvent.click(screen.getByRole("combobox", { name: "Country" }));
    const search = screen.getByRole("searchbox", { name: "Search" });
    fireEvent.change(search, { target: { value: "united" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("US");
  });

  it("delegates filtering to the server when onSearch is given", () => {
    const onSearch = vi.fn();
    render(
      <SearchSelect label="Brand" value="" options={OPTIONS} onChange={() => {}} onSearch={onSearch} placeholder="Select" searchPlaceholder="Search" emptyText="None" />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Brand" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(onSearch).toHaveBeenCalledWith("zzz");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PhoneNumberField from "@/components/forms/PhoneNumberField";

function setup(value = "") {
  const onChange = vi.fn();
  render(
    <PhoneNumberField
      value={value}
      onChange={onChange}
      countryLabel="Country code"
      numberLabel="Phone number"
      selectClassName=""
      inputClassName=""
    />,
  );
  return onChange;
}

function selectCountry(name: string) {
  fireEvent.click(screen.getByLabelText("Country code"));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(`^${name}`) }));
}

describe("PhoneNumberField", () => {
  it("combines the selected country and the typed number into one string", () => {
    const onChange = setup();
    selectCountry("France");
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "612345678" } });
    expect(onChange).toHaveBeenLastCalledWith("+33612345678");
  });

  it("keeps the chosen country when the number field is still empty", () => {
    const onChange = setup();
    selectCountry("United States");
    expect(screen.getByLabelText("Country code")).toHaveTextContent("+1");
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "2025551234" } });
    expect(onChange).toHaveBeenLastCalledWith("+12025551234");
  });

  it("splits an existing stored value back into its country and national parts", () => {
    setup("+393920618739");
    expect(screen.getByLabelText("Country code")).toHaveTextContent("+39");
    expect((screen.getByLabelText("Phone number") as HTMLInputElement).value).toBe("3920618739");
  });

  it("defaults to Italy for a value it doesn't recognize", () => {
    setup("not-a-phone-number");
    expect(screen.getByLabelText("Country code")).toHaveTextContent("+39");
  });
});

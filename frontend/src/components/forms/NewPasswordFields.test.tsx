import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import NewPasswordFields from "@/components/forms/NewPasswordFields";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <form data-testid="form">
      <NewPasswordFields value={value} onChange={setValue} label="Password" inputClassName="" />
    </form>
  );
}

describe("NewPasswordFields", () => {
  it("blocks the form while the confirmation differs and shows the passwords on demand", () => {
    render(<Harness />);
    const [password, confirm] = screen.getAllByLabelText(/password/i).filter((el) => el.tagName === "INPUT" && (el as HTMLInputElement).type === "password");
    fireEvent.change(password, { target: { value: "Secret123!" } });
    fireEvent.change(confirm, { target: { value: "Secret124!" } });
    expect(screen.getByRole("alert")).toHaveTextContent("do not match");
    expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(false);

    fireEvent.change(confirm, { target: { value: "Secret123!" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(true);

    fireEvent.click(screen.getByLabelText("Show password"));
    expect((password as HTMLInputElement).type).toBe("text");
  });
});

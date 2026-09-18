import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ConfirmPolicyChangeDialog from "@/components/staff/ConfirmPolicyChangeDialog";

function renderDialog(overrides = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmPolicyChangeDialog
      locale="en"
      title="Confirm the policy change"
      body="Turning this on affects future submissions only."
      submitting={false}
      error={null}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmPolicyChangeDialog", () => {
  it("explains the future-only effect", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Turning this on affects future submissions only.",
    );
  });

  it("refuses to confirm without a reason", async () => {
    const { onConfirm } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a reason before confirming.",
    );
  });

  it("refuses to confirm on whitespace alone", async () => {
    const { onConfirm } = renderDialog();

    await userEvent.type(screen.getByLabelText(/reason/i), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("passes the trimmed reason up", async () => {
    const { onConfirm } = renderDialog();

    await userEvent.type(screen.getByLabelText(/reason/i), "  Vetted partner. ");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledWith("Vetted partner.");
  });

  it("cancels without confirming", async () => {
    const { onCancel, onConfirm } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows a server error and disables the buttons while saving", () => {
    renderDialog({ submitting: true, error: "The change could not be saved." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The change could not be saved.",
    );
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});

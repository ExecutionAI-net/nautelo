import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ReplyComposer from "@/components/messages/ReplyComposer";

const LONG = "Thank you for getting in touch, next Tuesday morning works well.";

describe("ReplyComposer", () => {
  it("refuses a reply below spec 15.1's 20-character floor without calling the API", async () => {
    const onSend = vi.fn();
    render(<ReplyComposer locale="en" disabled={false} onSend={onSend} />);
    await userEvent.type(screen.getByLabelText("Reply"), "too short");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      screen.getByText("A reply must be at least 20 characters."),
    ).toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends a valid reply and clears the box", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<ReplyComposer locale="en" disabled={false} onSend={onSend} />);
    const box = screen.getByLabelText("Reply");
    await userEvent.type(box, LONG);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith(LONG));
    await waitFor(() => expect(box).toHaveValue(""));
  });

  it("keeps the text when sending fails, so nothing a person wrote is lost", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("boom"));
    render(<ReplyComposer locale="en" disabled={false} onSend={onSend} />);
    const box = screen.getByLabelText("Reply");
    await userEvent.type(box, LONG);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(box).toHaveValue(LONG));
  });

  it("disables the control entirely when the thread is not open", () => {
    render(<ReplyComposer locale="en" disabled onSend={vi.fn()} />);
    expect(screen.getByLabelText("Reply")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("prevents a double submit while a send is in flight", async () => {
    let resolve!: () => void;
    const onSend = vi.fn(
      () => new Promise<void>((r) => {
        resolve = r;
      }),
    );
    render(<ReplyComposer locale="en" disabled={false} onSend={onSend} />);
    await userEvent.type(screen.getByLabelText("Reply"), LONG);
    const button = screen.getByRole("button", { name: "Send" });
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    resolve();
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
  });
});

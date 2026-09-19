import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ConversationContextPanel from "@/components/messages/ConversationContextPanel";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ConversationContextPanel", () => {
  it("links a professional context, because that page exists", () => {
    render(
      <ConversationContextPanel
        locale="en"
        context={{
          type: "PROFESSIONAL",
          id: "p-1",
          label: "Phase19 Survey Co",
          url: "/services/professionals/phase19-survey-co/",
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /Phase19 Survey Co/ })).toHaveAttribute(
      "href",
      "/services/professionals/phase19-survey-co/",
    );
  });

  it("does NOT link a broker context, because /brokers/ has no page yet", () => {
    // Spec 39 and the precedent in PrimaryNav.test.tsx: never ship a control
    // that leads to a 404. Phase 20 builds /brokers/ and deletes the allowlist.
    render(
      <ConversationContextPanel
        locale="en"
        context={{
          type: "BROKER",
          id: "b-1",
          label: "Phase19 Alpha Brokers",
          url: "/brokers/phase19-alpha-brokers/",
        }}
      />,
    );
    expect(screen.getByText("Phase19 Alpha Brokers")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not link a listing context, whose url is null", () => {
    render(
      <ConversationContextPanel
        locale="en"
        context={{ type: "LISTING", id: "l-1", label: "Beneteau Oceanis 46.1", url: null }}
      />,
    );
    expect(screen.getByText("Beneteau Oceanis 46.1")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("names the context type in the reader's locale", () => {
    render(
      <ConversationContextPanel
        locale="es"
        context={{ type: "LISTING", id: "l-1", label: "Oceanis", url: null }}
      />,
    );
    expect(screen.getByText("Anuncio")).toBeInTheDocument();
  });
});

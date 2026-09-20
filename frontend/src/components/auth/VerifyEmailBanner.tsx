"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";

/** Shown on every dashboard while the signed-in email is unverified: most screens refuse to load until it is. */
export default function VerifyEmailBanner() {
  // Outside a SessionProvider (or before one answers) there is nothing to warn about.
  let session = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- useContext runs before any throw, so hook order is stable
    session = useSession().session ?? null;
  } catch {
    session = null;
  }
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const user = session?.authenticated ? session.user : null;
  if (!user || user.email_verified) return null;

  async function resend() {
    setState("sending");
    try {
      await apiFetch("/api/v1/auth/resend-verification/", { method: "POST", body: JSON.stringify({ email: user?.email }) });
      setState("sent");
    } catch {
      setState("failed");
    }
  }

  return (
    <div role="alert" className="mb-space-lg rounded-xl bg-error-container p-space-md text-on-error-container">
      <p className="font-title-md">Verify your email address to unlock your account.</p>
      <p className="mt-1 font-body-sm">
        Until {user.email} is verified, your profile, team, billing and messages stay locked. Open the link we emailed you, or ask for a new one.
      </p>
      <button
        type="button"
        disabled={state === "sending" || state === "sent"}
        onClick={() => void resend()}
        className="mt-space-sm rounded-lg bg-primary px-space-md py-space-xs font-label-md text-on-primary disabled:opacity-60"
      >
        {state === "sent" ? "Email sent - check your inbox" : "Send me a new verification email"}
      </button>
      {state === "failed" ? <p className="mt-space-xs font-body-sm">The email could not be sent. Please try again shortly.</p> : null}
    </div>
  );
}

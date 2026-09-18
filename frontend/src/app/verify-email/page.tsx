"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";

type VerifyState = "pending" | "done" | "failed";

function VerifyEmail() {
  const searchParams = useSearchParams();
  const { reload } = useSession();
  const token = searchParams.get("token");
  const [state, setState] = useState<VerifyState>("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // A tokenless link is decided during render, not here: setting state
    // synchronously inside an effect body triggers a cascading render.
    if (!token) return;
    apiFetch<unknown>("/api/v1/auth/verify-email/", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(async () => {
        setState("done");
        await reload();
      })
      .catch((caught: unknown) => {
        setState("failed");
        setMessage(
          caught instanceof ApiError
            ? "This verification link is invalid or has already been used."
            : "Verification could not be completed. Please try again.",
        );
      });
  }, [token, reload]);

  if (!token) {
    return (
      <p role="alert" className="font-body-md text-error">
        This verification link is missing its token.
      </p>
    );
  }
  if (state === "pending") return <p className="font-body-md">Verifying…</p>;
  if (state === "done") {
    return (
      <p className="font-body-md text-on-surface">
        Your email address is verified. You can now send inquiries and publish
        listings.
      </p>
    );
  }
  return (
    <p role="alert" className="font-body-md text-error">
      {message}
    </p>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-space-lg">
      <Suspense fallback={<p className="font-body-md">Loading…</p>}>
        <VerifyEmail />
      </Suspense>
    </main>
  );
}

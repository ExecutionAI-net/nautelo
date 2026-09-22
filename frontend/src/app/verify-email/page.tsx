"use client";

import { useT } from "@/i18n/client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";

type VerifyState = "pending" | "done" | "failed";

function VerifyEmail() {
  const t = useT();
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
            ? t("auth.verify.invalid")
            : t("auth.verify.failed"),
        );
      });
  }, [token, reload, t]);

  if (!token) {
    return (
      <p role="alert" className="font-body-md text-error">
        {t("auth.verify.missing_token")}
      </p>
    );
  }
  if (state === "pending") return <p className="font-body-md">{t("auth.verify.pending")}</p>;
  if (state === "done") {
    return (
      <p className="font-body-md text-on-surface">
        {t("auth.verify.done")}
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
  const t = useT();
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-background p-space-lg">
      <Suspense fallback={<p className="font-body-md">{t("auth.verify.loading")}</p>}>
        <VerifyEmail />
      </Suspense>
    </main>
  );
}

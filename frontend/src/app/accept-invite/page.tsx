"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import AuthShell from "@/components/auth/AuthShell";
import { ApiError, apiFetch } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";

interface Preview {
  organization: string;
  org_type: string;
  role: string;
  email: string;
  account_exists: boolean;
}

const INPUT =
  "mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md";

function AcceptInvite() {
  const token = useSearchParams().get("token") ?? "";
  const { session, reload } = useSession();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(!token);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<Preview>("/api/v1/auth/invitations/preview/", { method: "POST", body: JSON.stringify({ token }) }).then(
      setPreview,
      () => setFailed(true),
    );
  }, [token]);

  async function accept(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/auth/invitations/accept/", {
        method: "POST",
        body: JSON.stringify({ token, password, full_name: fullName }),
      });
      setDone(true);
      await reload();
    } catch (caught) {
      const first = caught instanceof ApiError ? Object.values(caught.fields)[0]?.[0]?.message : undefined;
      setError(first ?? "The invitation could not be accepted.");
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <p role="alert" className="font-body-md">
        This invitation is invalid, expired or already used. Ask your team administrator to send a new one.
      </p>
    );
  }
  if (!preview) return <p className="font-body-md">Checking your invitation…</p>;
  if (done) {
    return (
      <div className="flex flex-col gap-space-sm">
        <p role="status" className="font-body-md">
          You have joined {preview.organization}.
        </p>
        <Link className="text-secondary underline" href={preview.org_type === "BROKER" ? "/dashboard/broker/" : "/dashboard/service-provider/"}>
          Open your dashboard
        </Link>
      </div>
    );
  }

  const signedInAsInvitee = session?.authenticated && session.user?.email?.toLowerCase() === preview.email.toLowerCase();

  return (
    <form className="flex flex-col gap-space-md" onSubmit={(event) => void accept(event)}>
      <p className="font-body-md">
        You are invited to join <strong>{preview.organization}</strong> as <strong>{preview.role.toLowerCase()}</strong> ({preview.email}).
      </p>
      {preview.account_exists ? (
        signedInAsInvitee ? (
          <p className="font-body-sm text-on-surface-variant">
            Accepting changes your account type to {preview.org_type === "BROKER" ? "broker" : "professional"}. Your existing listings stay yours.
          </p>
        ) : (
          <p className="font-body-md">
            An account already exists for this address.{" "}
            <Link className="text-secondary underline" href={`/login/?next=${encodeURIComponent(`/accept-invite/?token=${token}`)}`}>
              Sign in
            </Link>{" "}
            with it to accept.
          </p>
        )
      ) : (
        <>
          <label className="block font-label-md text-label-md">
            Full name
            <input className={INPUT} autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            Choose a password
            <input className={INPUT} type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
        </>
      )}
      {error ? (
        <p role="alert" className="font-body-sm text-error">
          {error}
        </p>
      ) : null}
      {!preview.account_exists || signedInAsInvitee ? (
        <button type="submit" disabled={busy} className="rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary disabled:opacity-50">
          Accept invitation
        </button>
      ) : null}
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <AuthShell tab="register" heading="Join your team">
      <Suspense fallback={null}>
        <AcceptInvite />
      </Suspense>
    </AuthShell>
  );
}

"use client";

import Link from "@/components/layout/LocaleLink";
import { useT } from "@/i18n/client";
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
  const t = useT();
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
      setError(first ?? t("auth.invite.failed"));
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <p role="alert" className="font-body-md">
        {t("auth.invite.invalid")}
      </p>
    );
  }
  if (!preview) return <p className="font-body-md">{t("auth.invite.checking")}</p>;
  if (done) {
    return (
      <div className="flex flex-col gap-space-sm">
        <p role="status" className="font-body-md">
          {t("auth.invite.joined", { organization: preview.organization })}
        </p>
        <Link className="text-secondary underline" href={preview.org_type === "BROKER" ? "/dashboard/broker/" : "/dashboard/service-provider/"}>
          {t("auth.invite.open_dashboard")}
        </Link>
      </div>
    );
  }

  const signedInAsInvitee = session?.authenticated && session.user?.email?.toLowerCase() === preview.email.toLowerCase();

  return (
    <form className="flex flex-col gap-space-md" onSubmit={(event) => void accept(event)}>
      <p className="font-body-md">
        {t("auth.invite.invited_as", { organization: preview.organization, role: preview.role.toLowerCase(), email: preview.email })}
      </p>
      {preview.account_exists ? (
        signedInAsInvitee ? (
          <p className="font-body-sm text-on-surface-variant">
            {t("auth.invite.account_exists_change_type", {
              type: preview.org_type === "BROKER" ? t("auth.invite.broker") : t("auth.invite.professional"),
            })}
          </p>
        ) : (
          <p className="font-body-md">
            {t("auth.invite.account_exists_sign_in")}{" "}
            <Link className="text-secondary underline" href={`/login/?next=${encodeURIComponent(`/accept-invite/?token=${token}`)}`}>
              {t("auth.invite.sign_in_to_accept")}
            </Link>{" "}
            {t("auth.invite.with_it_to_accept")}
          </p>
        )
      ) : (
        <>
          <label className="block font-label-md text-label-md">
            {t("auth.invite.full_name")}
            <input className={INPUT} autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            {t("auth.invite.choose_password")}
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
          {t("auth.invite.accept")}
        </button>
      ) : null}
    </form>
  );
}

export default function AcceptInvitePage() {
  const t = useT();
  return (
    <AuthShell tab="register" heading={t("auth.invite.heading")}>
      <Suspense fallback={null}>
        <AcceptInvite />
      </Suspense>
    </AuthShell>
  );
}

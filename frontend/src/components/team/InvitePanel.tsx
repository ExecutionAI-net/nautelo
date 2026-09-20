"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api/client";

const JSON_HEADERS = { "Content-Type": "application/json" };
const ROLES = ["ADMIN", "MANAGER", "AGENT", "VIEWER"] as const;

interface Invitation {
  id: string;
  email: string;
  role: string;
  invited_by: string | null;
  expires_at: string;
}

const REASONS: Record<string, string> = {
  already_member: "This person already belongs to an organization.",
  not_invitable: "This address cannot be invited.",
  plan_seat_limit_reached: "Your plan has no free team seats left.",
};

/** Invite people by email and manage pending invitations. `baseUrl` is the collection endpoint. */
export default function InvitePanel({ baseUrl, onChange }: { baseUrl: string; onChange?: () => void }) {
  const [pending, setPending] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("AGENT");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setPending(await apiFetch<Invitation[]>(baseUrl));
    } catch {
      setPending([]);
    }
  }, [baseUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void reload();
  }, [reload]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch(baseUrl, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ email, role }) });
      setMessage(`Invitation sent to ${email}.`);
      setEmail("");
      await reload();
      onChange?.();
    } catch (caught) {
      const first = caught instanceof ApiError ? Object.values(caught.fields)[0]?.[0]?.message : undefined;
      setMessage((first && REASONS[first]) || "The invitation could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(invitation: Invitation) {
    try {
      await apiFetch(`${baseUrl}${invitation.id}/`, { method: "DELETE" });
      await reload();
    } catch {
      setMessage("The invitation could not be cancelled.");
    }
  }

  return (
    <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm" aria-label="Invitations">
      <h2 className="font-title-lg text-title-lg text-primary">Invite a team member</h2>
      <form className="grid gap-space-sm sm:grid-cols-[1fr_auto_auto]" onSubmit={(event) => void send(event)}>
        <label className="font-label-md text-label-md">
          Email
          <input
            className="mt-space-xs w-full rounded-lg border border-outline-variant bg-surface p-space-sm font-body-md"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="font-label-md text-label-md">
          Role
          <select
            className="mt-space-xs w-full rounded-lg border border-outline-variant bg-surface p-space-sm font-body-md"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {ROLES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="self-end rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary disabled:opacity-50"
        >
          Send invitation
        </button>
      </form>
      {message ? (
        <p role="status" className="font-body-sm">
          {message}
        </p>
      ) : null}
      {pending.length > 0 ? (
        <ul className="divide-y divide-surface-container">
          {pending.map((invitation) => (
            <li key={invitation.id} className="flex items-center justify-between gap-space-sm py-space-xs">
              <span className="font-body-md">
                {invitation.email} <span className="text-on-surface-variant">as {invitation.role}, expires {new Date(invitation.expires_at).toLocaleDateString("en-GB")}</span>
              </span>
              <button type="button" className="text-error font-label-md" onClick={() => void revoke(invitation)}>
                Cancel
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body-sm text-on-surface-variant">No pending invitations.</p>
      )}
    </section>
  );
}

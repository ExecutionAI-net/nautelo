"use client";

import { useCallback, useEffect, useState } from "react";

import InvitePanel from "@/components/team/InvitePanel";
import { apiFetch } from "@/lib/api/client";

const JSON_HEADERS = { "Content-Type": "application/json" };
const ROLES = ["ADMIN", "MANAGER", "AGENT", "VIEWER"] as const;

interface Member {
  id: string;
  user_email: string;
  user_full_name: string;
  role: string;
  is_owner: boolean;
  can_edit_profile: boolean;
  can_manage_team: boolean;
  can_read_messages: boolean;
  show_on_profile: boolean;
  is_active: boolean;
}

const ROLE_HELP: Record<string, string> = {
  ADMIN: "Everything, including the team and billing.",
  MANAGER: "Edits the profile and services, reads messages.",
  AGENT: "Edits the profile and services.",
  VIEWER: "Read only.",
};

/** Team, roles and permissions for a professional organization. */
export default function ProviderTeam() {
  const [members, setMembers] = useState<Member[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setMembers(await apiFetch<Member[]>("/api/v1/provider/team/"));
    } catch {
      setMessage("The team could not be loaded.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void reload();
  }, [reload]);

  async function patch(member: Member, body: Record<string, unknown>, done: string) {
    setMessage(null);
    try {
      await apiFetch(`/api/v1/provider/team/${member.id}/`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(body) });
      setMessage(done);
      await reload();
    } catch {
      setMessage("The change was refused. Only administrators can change roles, and the owner cannot be changed.");
    }
  }

  async function remove(member: Member) {
    setMessage(null);
    try {
      await apiFetch(`/api/v1/provider/team/${member.id}/`, { method: "DELETE" });
      setMessage("Member removed.");
      await reload();
    } catch {
      setMessage("The member could not be removed.");
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <div>
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Service provider / Team</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Team, roles and permissions</h1>
      </div>
      {message ? (
        <p role="status" className="font-body-md">
          {message}
        </p>
      ) : null}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-body-sm">
          <thead className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Member</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Access</th>
              <th className="py-3 px-4">On profile</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {members.map((member) => (
              <tr key={member.id} className={member.is_active ? "" : "opacity-50"}>
                <td className="py-3.5 px-4">
                  <div className="flex flex-col min-w-0">
                    <span className="font-title-md text-primary font-semibold truncate">
                      {member.user_full_name || member.user_email}
                      {member.is_owner ? " (owner)" : ""}
                    </span>
                    <span className="text-on-surface-variant truncate">{member.user_email}</span>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <select
                    aria-label={`Role of ${member.user_email}`}
                    value={member.role}
                    disabled={member.is_owner || !member.is_active}
                    onChange={(event) => void patch(member, { role: event.target.value }, "Role updated.")}
                    className="rounded-lg bg-surface-container-low px-space-sm py-1"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-on-surface-variant">{ROLE_HELP[member.role]}</p>
                </td>
                <td className="py-3.5 px-4 text-on-surface-variant">
                  {[member.can_edit_profile && "Profile", member.can_manage_team && "Team", member.can_read_messages && "Messages"].filter(Boolean).join(" - ") || "Read only"}
                </td>
                <td className="py-3.5 px-4">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={member.show_on_profile}
                      onChange={(event) => void patch(member, { show_on_profile: event.target.checked }, "Profile visibility updated.")}
                    />
                    Shown
                  </label>
                </td>
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  {member.is_owner ? null : member.is_active ? (
                    <button type="button" className="text-error font-title-md px-2 py-1" onClick={() => void remove(member)}>
                      Remove
                    </button>
                  ) : (
                    <span className="text-on-surface-variant">Removed</span>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 ? (
              <tr>
                <td className="py-space-md px-4 text-on-surface-variant" colSpan={5}>
                  No members.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <InvitePanel baseUrl="/api/v1/provider/team/invitations/" />
    </div>
  );
}

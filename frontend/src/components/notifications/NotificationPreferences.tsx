"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchNotificationPreferences,
  setNotificationPreferences,
  type NotificationPreferences as Preferences,
} from "@/lib/api/notifications";

const CATEGORIES: { field: keyof Preferences; label: string; description: string }[] = [
  { field: "messages_enabled", label: "Messages", description: "A new message or reply on one of your conversations." },
  { field: "listings_enabled", label: "Listing updates", description: "Approvals, requested changes, rejections, and expiry reminders." },
  { field: "billing_enabled", label: "Billing & account status", description: "Trials, failed payments, and changes to your account status." },
];

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPrefs(await fetchNotificationPreferences());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  async function toggle(field: keyof Preferences, value: boolean) {
    if (!prefs) return;
    setMessage(null);
    const previous = prefs;
    setPrefs({ ...prefs, [field]: value });
    try {
      setPrefs(await setNotificationPreferences({ [field]: value }));
    } catch {
      setPrefs(previous);
      setMessage("That change could not be saved.");
    }
  }

  if (error) return <p role="alert">Your notification preferences could not be loaded.</p>;
  if (!prefs) return <p>Loading...</p>;

  return (
    <div className="flex flex-col gap-space-lg">
      <div>
        <h2 className="font-headline-sm text-headline-sm text-primary tracking-tight">Email preferences</h2>
        <p className="mt-space-xs font-body-md text-on-surface-variant">
          Choose which emails Nautelo sends you. You always see these as in-app notifications regardless of what&apos;s selected here.
        </p>
        {message ? (
          <p role="status" className="mt-space-xs font-body-md text-error">
            {message}
          </p>
        ) : null}
      </div>

      <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-space-lg flex flex-col gap-space-md">
        <label className="flex items-start justify-between gap-space-md border-b border-surface-container-high pb-space-md">
          <span className="flex flex-col">
            <span className="font-title-md text-title-md text-primary font-semibold">All email notifications</span>
            <span className="font-body-sm text-on-surface-variant">The master switch. Turning this off stops every email below, regardless of its own setting.</span>
          </span>
          <input
            type="checkbox"
            className="mt-1 shrink-0"
            checked={prefs.email_enabled}
            onChange={(event) => void toggle("email_enabled", event.target.checked)}
          />
        </label>

        {CATEGORIES.map((category) => (
          <label key={category.field} className="flex items-start justify-between gap-space-md">
            <span className="flex flex-col">
              <span className="font-title-md text-title-md text-primary font-semibold">{category.label}</span>
              <span className="font-body-sm text-on-surface-variant">{category.description}</span>
            </span>
            <input
              type="checkbox"
              className="mt-1 shrink-0"
              disabled={!prefs.email_enabled}
              checked={prefs[category.field]}
              onChange={(event) => void toggle(category.field, event.target.checked)}
            />
          </label>
        ))}
      </section>
    </div>
  );
}

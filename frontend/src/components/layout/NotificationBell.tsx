"use client";

import Link from "@/components/layout/LocaleLink";
import { useCallback, useEffect, useState } from "react";

import {
  fetchNotificationPreferences,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setEmailNotifications,
  type NotificationRow,
} from "@/lib/api/notifications";
import { connectNotifications } from "@/lib/realtime/notificationSocket";
import type { Locale } from "@/lib/i18n/directory";
import { NOTIFICATION_TEXT } from "@/lib/i18n/notifications";

const POLL_MS = 60_000;

const UI = {
  en: { label: "Notifications", empty: "No notifications", markAll: "Mark all as read", email: "Email me about these", unread: "unread" },
  it: { label: "Notifiche", empty: "Nessuna notifica", markAll: "Segna tutto come letto", email: "Inviami anche un'email", unread: "non lette" },
  es: { label: "Notificaciones", empty: "Sin notificaciones", markAll: "Marcar todo como leido", email: "Enviarme tambien un correo", unread: "sin leer" },
} as const;

function text(key: string, locale: Locale): string {
  const entry = NOTIFICATION_TEXT[key];
  if (!entry) return "";
  return entry[locale.toUpperCase() as "EN" | "IT" | "ES"] ?? entry.EN;
}

/** A target_url is only followed when it is a local path (no open redirect). */
function safeTarget(url: string): string | null {
  return url.startsWith("/") && !url.startsWith("//") ? url : null;
}

/** `align` is the edge the popover hangs from: "left" when the bell sits near the left edge of the screen (dashboard sidebar). */
export default function NotificationBell({ locale, align = "right" }: { locale: Locale; align?: "left" | "right" }) {
  const ui = UI[locale] ?? UI.en;
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [emailOn, setEmailOn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchNotificationPreferences()
      .then((pref) => {
        if (!cancelled) setEmailOn(pref.email_enabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function toggleEmail(next: boolean) {
    setEmailOn(next);
    try {
      await setEmailNotifications(next);
    } catch {
      setEmailOn(!next);
    }
  }

  const load = useCallback(async () => {
    try {
      const page = await fetchNotifications();
      setRows(page.results);
      setUnread(page.unread_count);
    } catch {
      // A failed poll keeps the last known state; the next tick retries.
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => connectNotifications({ onChange: () => void load() }), [load]);

  async function read(row: NotificationRow) {
    if (row.read_at) return;
    try {
      await markNotificationRead(row.id);
      await load();
    } catch {
      // Leave it unread; the user can retry.
    }
  }

  async function readAll() {
    try {
      await markAllNotificationsRead();
      await load();
    } catch {
      // Leave state unchanged.
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${ui.label}${unread ? `, ${unread} ${ui.unread}` : ""}`}
        onClick={() => setOpen((value) => !value)}
        title={ui.label}
        className="relative inline-flex items-center rounded-lg p-1 text-primary hover:bg-surface-container"
      >
        <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-error px-1 text-center font-label-sm text-[10px] leading-4 text-on-error">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className={`absolute z-10 mt-space-xs w-80 max-w-[90vw] rounded-lg border border-outline-variant bg-surface p-space-sm shadow-lg ${align === "left" ? "left-0" : "right-0"}`}>
          {emailOn !== null ? (
            <label className="mb-space-sm block font-body-sm">
              <input type="checkbox" checked={emailOn} onChange={(e) => void toggleEmail(e.target.checked)} />{" "}
              {ui.email}
            </label>
          ) : null}
          {rows.length === 0 ? (
            <p className="font-body-sm text-on-surface-variant">{ui.empty}</p>
          ) : (
            <>
              <ul className="flex max-h-96 flex-col gap-space-xs overflow-y-auto">
                {rows.map((row) => {
                  const target = safeTarget(row.target_url);
                  const body = (
                    <>
                      <span className="block font-title-sm text-title-sm text-on-surface">
                        {text(row.title_key, locale)}
                      </span>
                      <span className="block font-body-sm text-on-surface-variant">
                        {text(row.body_key, locale)}
                      </span>
                    </>
                  );
                  return (
                    <li
                      key={row.id}
                      data-unread={row.read_at ? "false" : "true"}
                      className={row.read_at ? "opacity-70" : "font-semibold"}
                    >
                      {target ? (
                        <Link href={target} onClick={() => void read(row)}>
                          {body}
                        </Link>
                      ) : (
                        <button type="button" className="text-left" onClick={() => void read(row)}>
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={() => void readAll()}
                  className="mt-space-sm font-body-sm text-primary underline"
                >
                  {ui.markAll}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

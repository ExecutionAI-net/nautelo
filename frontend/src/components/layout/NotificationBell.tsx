"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "@/lib/api/notifications";
import type { Locale } from "@/lib/i18n/directory";
import { NOTIFICATION_TEXT } from "@/lib/i18n/notifications";

const POLL_MS = 60_000;

const UI = {
  en: { label: "Notifications", empty: "No notifications", markAll: "Mark all as read", unread: "unread" },
  it: { label: "Notifiche", empty: "Nessuna notifica", markAll: "Segna tutto come letto", unread: "non lette" },
  es: { label: "Notificaciones", empty: "Sin notificaciones", markAll: "Marcar todo como leido", unread: "sin leer" },
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

export default function NotificationBell({ locale }: { locale: Locale }) {
  const ui = UI[locale] ?? UI.en;
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

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
        className="font-label-md text-label-md text-primary"
      >
        {ui.label}
        {unread > 0 ? (
          <span className="ml-space-xs rounded-full bg-primary px-space-xs text-on-primary">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-space-xs w-80 max-w-[90vw] rounded-lg border border-outline-variant bg-surface p-space-sm shadow-lg">
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

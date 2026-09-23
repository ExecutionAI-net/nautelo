"use client";

import Link from "@/components/layout/LocaleLink";
import { useCallback, useEffect, useState } from "react";

import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type NotificationRow } from "@/lib/api/notifications";
import { formatDateTime } from "@/lib/i18n/datetime";
import type { Locale } from "@/lib/i18n/directory";
import { NOTIFICATION_TEXT } from "@/lib/i18n/notifications";
import { useLocale } from "@/lib/i18n/useLocale";

const UI = {
  en: { title: "Recent notifications", empty: "No notifications yet.", markAll: "Mark all as read", failed: "Notifications could not be loaded." },
  it: { title: "Notifiche recenti", empty: "Nessuna notifica.", markAll: "Segna tutto come letto", failed: "Impossibile caricare le notifiche." },
  es: { title: "Notificaciones recientes", empty: "Sin notificaciones.", markAll: "Marcar todo como leido", failed: "No se pudieron cargar las notificaciones." },
} as const;

function text(key: string, locale: Locale): string {
  const entry = NOTIFICATION_TEXT[key];
  if (!entry) return "";
  return entry[locale.toUpperCase() as "EN" | "IT" | "ES"] ?? entry.EN;
}

function safeTarget(url: string): string | null {
  return url.startsWith("/") && !url.startsWith("//") ? url : null;
}

/** The full in-app notification list for the dashboard Notifications page (the bell only shows the latest few). */
export default function NotificationList() {
  const locale = useLocale();
  const ui = UI[locale] ?? UI.en;
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await fetchNotifications();
      setRows(page.results);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    return () => clearTimeout(first);
  }, [load]);

  async function read(row: NotificationRow) {
    if (row.read_at) return;
    try {
      await markNotificationRead(row.id);
      await load();
    } catch {
      // Leave it unread; the next click retries.
    }
  }

  async function readAll() {
    try {
      await markAllNotificationsRead();
      await load();
    } catch {
      // ignore
    }
  }

  const unread = (rows ?? []).filter((row) => !row.read_at).length;

  return (
    <section aria-labelledby="notification-list-title" className="flex flex-col gap-space-sm">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <h2 id="notification-list-title" className="font-title-lg text-title-lg text-primary">
          {ui.title}
        </h2>
        {unread > 0 ? (
          <button type="button" onClick={() => void readAll()} className="font-label-md text-primary underline-offset-2 hover:underline">
            {ui.markAll}
          </button>
        ) : null}
      </div>
      {failed ? (
        <p role="alert" className="font-body-md text-error">
          {ui.failed}
        </p>
      ) : rows === null ? null : rows.length === 0 ? (
        <p className="font-body-md text-on-surface-variant">{ui.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-outline-variant/40 rounded-xl bg-surface-container-lowest shadow-sm">
          {rows.map((row) => {
            const target = safeTarget(row.target_url);
            const body = (
              <>
                <span className={`block font-title-sm text-title-sm ${row.read_at ? "text-on-surface-variant" : "text-on-surface"}`}>
                  {text(row.title_key, locale)}
                </span>
                <span className="block font-body-sm text-on-surface-variant">{text(row.body_key, locale)}</span>
                <span className="block font-label-sm text-on-surface-variant">{formatDateTime(locale, row.created_at)}</span>
              </>
            );
            return (
              <li key={row.id} data-unread={row.read_at ? "false" : "true"} className={`p-space-sm ${row.read_at ? "" : "bg-surface-container-low"}`}>
                {target ? (
                  <Link href={target} onClick={() => void read(row)} className="block">
                    {body}
                  </Link>
                ) : (
                  <button type="button" className="block w-full text-left" onClick={() => void read(row)}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

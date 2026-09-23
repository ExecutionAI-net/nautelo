// Notification inbox (spec 27): REST is the source of truth; the browser only
// ever calls it through apiFetch (authenticated).
import { apiFetch } from "@/lib/api/client";

export interface NotificationRow {
  id: string;
  type: string;
  title_key: string;
  body_key: string;
  payload: Record<string, unknown>;
  target_url: string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPage {
  results: NotificationRow[];
  unread_count: number;
}

export function fetchNotifications(): Promise<NotificationPage> {
  return apiFetch<NotificationPage>("/api/v1/notifications/");
}

export function markNotificationRead(id: string): Promise<NotificationRow> {
  return apiFetch<NotificationRow>(`/api/v1/notifications/${encodeURIComponent(id)}/read/`, {
    method: "POST",
  });
}

export function markAllNotificationsRead(): Promise<{ marked_read: number }> {
  return apiFetch<{ marked_read: number }>("/api/v1/notifications/read-all/", {
    method: "POST",
  });
}

export interface NotificationPreferences {
  email_enabled: boolean;
  messages_enabled: boolean;
  listings_enabled: boolean;
  billing_enabled: boolean;
}

export function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  return apiFetch("/api/v1/notifications/preferences/");
}

export function setEmailNotifications(email_enabled: boolean): Promise<NotificationPreferences> {
  return apiFetch("/api/v1/notifications/preferences/", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email_enabled }),
  });
}

export function setNotificationPreferences(
  updates: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return apiFetch("/api/v1/notifications/preferences/", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

import { apiFetch } from "@/lib/api/client";

export interface PlatformSettingRow {
  key: string;
  type: "boolean" | "integer" | "decimal";
  default: boolean | number | string;
  value: boolean | number | string;
  updated_at: string | null;
}

export const fetchPlatformSettings = () =>
  apiFetch<{ settings_version: number; settings: PlatformSettingRow[] }>("/api/v1/staff/settings/");

export const updatePlatformSetting = (key: string, value: boolean | number | string) =>
  apiFetch<{ key: string; value: unknown }>("/api/v1/staff/settings/", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });

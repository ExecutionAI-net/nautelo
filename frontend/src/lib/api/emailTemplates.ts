import { apiFetch } from "@/lib/api/client";

const JSON_HEADERS = { "Content-Type": "application/json" };

export type EmailLocale = "EN" | "IT" | "ES";

export interface EmailTemplateLocaleCell {
  exists: boolean;
  subject?: string;
  updated_at?: string;
}

export interface EmailTemplateSummary {
  key: string;
  label: string;
  variables: string[];
  locales: Record<EmailLocale, EmailTemplateLocaleCell>;
}

export interface EmailTemplateDetail {
  key: string;
  locale: EmailLocale;
  label: string;
  variables: string[];
  exists: boolean;
  subject: string;
  html_body: string;
}

export const staffEmailTemplates = {
  list: () => apiFetch<{ templates: EmailTemplateSummary[] }>("/api/v1/staff/email-templates/"),
  get: (key: string, locale: EmailLocale) =>
    apiFetch<EmailTemplateDetail>(`/api/v1/staff/email-templates/${key}/${locale}/`),
  save: (key: string, locale: EmailLocale, body: { subject: string; html_body: string }) =>
    apiFetch<{ saved: true }>(`/api/v1/staff/email-templates/${key}/${locale}/`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),
  preview: (key: string, locale: EmailLocale, body: { subject: string; html_body: string }) =>
    apiFetch<{ subject: string; html: string }>(`/api/v1/staff/email-templates/${key}/${locale}/preview/`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),
  testSend: (key: string, locale: EmailLocale, body: { subject: string; html_body: string }) =>
    apiFetch<{ sent_to: string }>(`/api/v1/staff/email-templates/${key}/${locale}/test-send/`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),
};

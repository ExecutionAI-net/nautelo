"use client";

import { useCallback, useEffect, useState } from "react";

import { staffEmailTemplates, type EmailLocale, type EmailTemplateSummary } from "@/lib/api/emailTemplates";

const LOCALES: EmailLocale[] = ["EN", "IT", "ES"];

function cellClasses(exists: boolean): string {
  return exists
    ? "bg-secondary-container/40 text-on-secondary-container hover:bg-secondary-container"
    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high";
}

export default function EmailTemplatesAdmin() {
  const [templates, setTemplates] = useState<EmailTemplateSummary[]>([]);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    try {
      setTemplates((await staffEmailTemplates.list()).templates);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void reload();
  }, [reload]);

  return (
    <div className="flex flex-col gap-space-xl">
      <section className="flex flex-col gap-space-xs max-w-3xl">
        <div className="inline-flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-secondary rounded-full" />
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Staff / Email templates</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Email templates</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Every transactional email Nautelo sends, per language. English is the fallback whenever a language has no template of its own yet.
        </p>
        {error ? (
          <p role="alert" className="font-body-md text-error">
            The template list could not be loaded.
          </p>
        ) : null}
      </section>

      <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-md text-body-md">
            <thead className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold" scope="col">Template</th>
                {LOCALES.map((locale) => (
                  <th key={locale} className="py-3.5 px-4 font-semibold" scope="col">
                    {locale}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.key} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-title-md text-title-md text-primary font-semibold">{template.label}</span>
                      <span className="text-body-sm font-body-sm text-on-surface-variant">
                        Variables: {template.variables.map((name) => `{{ ${name} }}`).join(", ")}
                      </span>
                    </div>
                  </td>
                  {LOCALES.map((locale) => {
                    const cell = template.locales[locale];
                    return (
                      <td key={locale} className="py-4 px-4">
                        <a
                          href={`/dashboard/staff/email-templates/${template.key}/${locale}/`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-sm text-label-sm font-semibold transition-colors ${cellClasses(cell.exists)}`}
                        >
                          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                            {cell.exists ? "check_circle" : "add_circle"}
                          </span>
                          {cell.exists ? "Edit" : "Create"}
                        </a>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {templates.length === 0 && !error ? (
                <tr>
                  <td className="py-space-md px-4 text-on-surface-variant" colSpan={LOCALES.length + 1}>
                    Loading templates...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

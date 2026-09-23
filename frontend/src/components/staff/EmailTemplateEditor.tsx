"use client";

import { useCallback, useEffect, useState } from "react";

import { staffEmailTemplates, type EmailLocale, type EmailTemplateDetail } from "@/lib/api/emailTemplates";

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md focus:outline-none";

export default function EmailTemplateEditor({ templateKey, locale }: { templateKey: string; locale: EmailLocale }) {
  const [detail, setDetail] = useState<EmailTemplateDetail | null>(null);
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await staffEmailTemplates.get(templateKey, locale);
      setDetail(data);
      setSubject(data.subject);
      setHtmlBody(data.html_body);
      setError(false);
    } catch {
      setError(true);
    }
  }, [templateKey, locale]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  async function refreshPreview() {
    try {
      const rendered = await staffEmailTemplates.preview(templateKey, locale, { subject, html_body: htmlBody });
      setPreviewHtml(rendered.html);
      setMessage(null);
    } catch {
      setMessage("The preview could not be rendered - check the template for a typo.");
    }
  }

  async function save() {
    setMessage(null);
    try {
      await staffEmailTemplates.save(templateKey, locale, { subject, html_body: htmlBody });
      setMessage("Saved.");
      await load();
    } catch {
      setMessage("The template could not be saved.");
    }
  }

  async function sendTest() {
    setMessage(null);
    try {
      const result = await staffEmailTemplates.testSend(templateKey, locale, { subject, html_body: htmlBody });
      setMessage(`Test email sent to ${result.sent_to}.`);
    } catch {
      setMessage("The test email could not be sent - check the template for a typo.");
    }
  }

  if (error) return <p role="alert">This template could not be loaded.</p>;
  if (!detail) return <p>Loading...</p>;

  return (
    <div className="flex flex-col gap-space-xl">
      <section className="flex flex-col gap-space-xs max-w-3xl">
        <div className="inline-flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-secondary rounded-full" />
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Staff Admin / Emailing</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
          {detail.label} &middot; {locale}
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Variables available in this template: {detail.variables.map((name) => `{{ ${name} }}`).join(", ")}. Preview and test-send use sample values, never a real user&apos;s data.
        </p>
        {message ? (
          <p role="status" className="font-body-md text-primary">
            {message}
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg items-start">
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-sm">
          <label className="font-label-sm uppercase text-on-surface-variant">
            Subject
            <input className={FIELD} value={subject} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            HTML body (renders inside the shared Nautelo header/footer)
            <textarea
              className={`${FIELD} font-mono text-body-sm`}
              rows={18}
              value={htmlBody}
              onChange={(event) => setHtmlBody(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-space-sm pt-space-xs">
            <button type="button" onClick={() => void save()} className="rounded-lg bg-primary px-4 py-2.5 font-body-md text-on-primary font-medium shadow-md">
              Save
            </button>
            <button type="button" onClick={() => void refreshPreview()} className="rounded-lg bg-surface-container px-4 py-2.5 font-body-md text-primary font-medium">
              Refresh preview
            </button>
            <button type="button" onClick={() => void sendTest()} className="rounded-lg bg-surface-container px-4 py-2.5 font-body-md text-primary font-medium">
              Send test to myself
            </button>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-space-md py-space-sm bg-surface-container-low font-label-sm uppercase text-on-surface-variant">Preview</div>
          {previewHtml ? (
            <iframe title="Email preview" srcDoc={previewHtml} className="w-full h-[720px] bg-white" />
          ) : (
            <p className="p-space-md text-on-surface-variant font-body-md">Click &quot;Refresh preview&quot; to render the current draft.</p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

// Spec 15.1's Message rule, which applies to a reply too. The SERVER is the
// authority (Phase 6's MessageCreateSerializer enforces the identical numbers);
// these exist only so a person is told before a round trip (spec 2.2).
export const REPLY_MIN_LENGTH = 20;
export const REPLY_MAX_LENGTH = 4000;

interface Props {
  locale: Locale;
  disabled: boolean;
  onSend: (body: string) => Promise<void>;
}

export default function ReplyComposer({ locale, disabled, onSend }: Props) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length < REPLY_MIN_LENGTH) {
      setError(tConversations(locale, "messages.reply.too_short"));
      return;
    }
    if (trimmed.length > REPLY_MAX_LENGTH) {
      setError(tConversations(locale, "messages.reply.too_long"));
      return;
    }
    setError(null);
    setSending(true);
    try {
      await onSend(trimmed);
      // Cleared only on success: a failed send must not throw away what a person
      // wrote, which is the one unrecoverable failure mode of a composer.
      setBody("");
    } catch {
      // The parent owns the error banner — it is the only layer that knows the
      // error code. Here we simply stop and keep the text.
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-space-lg rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      <label
        htmlFor="reply-body"
        className="block font-label-md text-label-md text-on-surface"
      >
        {tConversations(locale, "messages.reply.label")}
      </label>
      <textarea
        id="reply-body"
        name="reply-body"
        rows={4}
        value={body}
        disabled={disabled || sending}
        onChange={(event) => setBody(event.target.value)}
        placeholder={tConversations(locale, "messages.reply.placeholder")}
        aria-invalid={error !== null}
        aria-describedby={error ? "reply-error" : undefined}
        className="mt-space-xs w-full rounded-lg bg-surface-container-low p-space-sm font-body-md focus:outline-none"
      />
      {error ? (
        <p id="reply-error" role="alert" className="mt-space-xs font-body-sm text-error">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={disabled || sending}
        className="mt-space-sm rounded-lg bg-primary px-space-lg py-space-sm font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-50"
      >
        {tConversations(
          locale,
          sending ? "messages.reply.sending" : "messages.reply.send",
        )}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";

import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

// A reply has no minimum length (one character or an emoji is fine); the server
// is the authority for the 4000 cap and this only tells a person before a round trip.
export const REPLY_MAX_LENGTH = 4000;

const EMOJIS = ["👍", "🙏", "😊", "😀", "😂", "👏", "🎉", "⛵", "🚤", "⚓", "🌊", "✅", "❤️", "👋"];

interface Props {
  locale: Locale;
  disabled: boolean;
  onSend: (body: string) => Promise<void>;
}

export default function ReplyComposer({ locale, disabled, onSend }: Props) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length === 0) {
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
      <div className="mt-space-xs flex flex-wrap items-center gap-space-xs">
        <button
          type="button"
          aria-expanded={emojiOpen}
          aria-label="Emoji"
          title="Emoji"
          onClick={() => setEmojiOpen((value) => !value)}
          className="inline-flex items-center rounded-lg p-1 text-primary hover:bg-surface-container"
        >
          <span className="material-symbols-outlined" aria-hidden="true">mood</span>
        </button>
        {emojiOpen
          ? EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Insert ${emoji}`}
                onClick={() => setBody((current) => current + emoji)}
                className="rounded p-1 text-xl hover:bg-surface-container"
              >
                {emoji}
              </button>
            ))
          : null}
      </div>
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

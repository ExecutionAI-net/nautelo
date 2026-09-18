"use client";

import { useState } from "react";

import type { Locale } from "@/lib/i18n/directory";
import { tStaffBroker } from "@/lib/i18n/staff-brokers";

/**
 * Spec §21 "Staff broker UI" items 4 and 5: the confirmation modal that
 * explains the future-only effect, and the mandatory reason field.
 *
 * It owns the reason and the client-side "is it blank" check only. The server
 * enforces the same rule again (`policy_reason_required`), because a browser
 * dialog is not a control — spec §39 forbids visual-only implementations. Shared
 * by the policy toggle (Task 8) and the bulk approve (Task 9), which differ only
 * in their title and body copy.
 */
export default function ConfirmPolicyChangeDialog({
  locale,
  title,
  body,
  submitting,
  error,
  onConfirm,
  onCancel,
}: {
  locale: Locale;
  title: string;
  body: string;
  submitting: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [blank, setBlank] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = reason.trim();
    if (!cleaned) {
      setBlank(true);
      return;
    }
    setBlank(false);
    onConfirm(cleaned);
  }

  // `error` comes from the server and always wins: a stale local "blank"
  // message must not hide the reason the save actually failed.
  const message = error ?? (blank ? tStaffBroker(locale, "staff.broker.reason_required") : null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="mt-space-md rounded-xl border border-outline bg-surface-container p-space-md"
    >
      <h3 className="font-title-md text-title-md text-on-surface">{title}</h3>
      <p className="mt-space-xs font-body-md text-on-surface-variant">{body}</p>
      <form onSubmit={handleSubmit} className="mt-space-sm flex flex-col gap-space-sm">
        <label className="font-label-md text-label-md" htmlFor="policy-change-reason">
          {tStaffBroker(locale, "staff.broker.reason_label")}
          <textarea
            id="policy-change-reason"
            name="reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md"
          />
        </label>
        {message ? (
          <p role="alert" className="font-body-sm text-error">
            {message}
          </p>
        ) : null}
        <div className="flex gap-space-sm">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md text-on-primary disabled:opacity-50"
          >
            {submitting
              ? tStaffBroker(locale, "staff.broker.saving")
              : tStaffBroker(locale, "staff.broker.confirm")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-outline px-space-md py-space-sm font-label-md text-label-md text-on-surface disabled:opacity-50"
          >
            {tStaffBroker(locale, "staff.broker.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}

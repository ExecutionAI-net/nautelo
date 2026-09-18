"use client";

import { useState } from "react";

import ConfirmPolicyChangeDialog from "@/components/staff/ConfirmPolicyChangeDialog";
import { ApiError } from "@/lib/api/client";
import {
  bulkApprovePendingSubmissions,
  type BulkApproveResponse,
  type StaffBrokerDetail,
} from "@/lib/api/staffBrokers";
import type { Locale } from "@/lib/i18n/directory";
import { tStaffBroker } from "@/lib/i18n/staff-brokers";

/**
 * Spec §21 rule 7: "Staff may bulk approve existing pending broker submissions
 * as a separate explicit action with confirmation and audit."
 *
 * Separate from the policy switch on purpose, and never triggered by it:
 * enabling auto-approval affects future submissions only (rule 5). The reason
 * dialog is reused from the policy change, because both actions need exactly
 * the same thing — a confirmation the user has to read and a reason the server
 * refuses to proceed without.
 *
 * The result is reported honestly: anything the server refused to publish is
 * listed with its listing id so staff can open it. No control is disabled to
 * hide a failure.
 */
export default function BulkApprovePanel({
  locale,
  broker,
  onUpdated,
}: {
  locale: Locale;
  broker: StaffBrokerDetail;
  onUpdated: (broker: StaffBrokerDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkApproveResponse | null>(null);

  async function handleConfirm(reason: string) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await bulkApprovePendingSubmissions(broker.id, { reason });
      setOpen(false);
      setResult(response);
      onUpdated(response.broker);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : tStaffBroker(locale, "staff.broker.save_failed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="bulk-approve-heading"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md"
    >
      <h2
        id="bulk-approve-heading"
        className="font-title-lg text-title-lg text-primary"
      >
        {tStaffBroker(locale, "staff.broker.bulk.title")}
      </h2>
      <p className="mt-space-xs font-body-sm text-on-surface-variant">
        {tStaffBroker(locale, "staff.broker.bulk.count")}
      </p>
      <p
        data-testid="pending-revision-count"
        className="font-title-md text-title-md text-on-surface"
      >
        {broker.pending_revision_count}
      </p>

      {broker.pending_revision_count === 0 ? (
        <p className="mt-space-sm font-body-md text-on-surface-variant">
          {tStaffBroker(locale, "staff.broker.bulk.none")}
        </p>
      ) : (
        <button
          type="button"
          disabled={open}
          onClick={() => {
            setError(null);
            setResult(null);
            setOpen(true);
          }}
          className="mt-space-sm rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md text-on-primary disabled:opacity-50"
        >
          {tStaffBroker(locale, "staff.broker.bulk.action")}
        </button>
      )}

      {open ? (
        <ConfirmPolicyChangeDialog
          locale={locale}
          title={tStaffBroker(locale, "staff.broker.bulk.confirm_title")}
          body={tStaffBroker(locale, "staff.broker.bulk.confirm_body")}
          submitting={submitting}
          error={error}
          onConfirm={handleConfirm}
          onCancel={() => {
            setOpen(false);
            setError(null);
          }}
        />
      ) : null}

      {result ? (
        <div className="mt-space-sm flex flex-col gap-space-xs">
          <p className="font-body-md text-on-surface">
            {tStaffBroker(locale, "staff.broker.bulk.approved")}:{" "}
            <span data-testid="bulk-approved-count">{result.approved_count}</span>
          </p>
          <p className="font-body-md text-on-surface">
            {tStaffBroker(locale, "staff.broker.bulk.failed")}:{" "}
            <span data-testid="bulk-failed-count">{result.failed_count}</span>
          </p>
          {result.failures.length > 0 ? (
            <ul className="flex flex-col gap-space-xs">
              {result.failures.map((failure) => (
                <li
                  key={failure.revision_id}
                  className="font-body-sm text-on-surface-variant"
                >
                  {`${failure.listing_id} — ${failure.message}`}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

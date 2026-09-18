"use client";

import { useState } from "react";

import ConfirmPolicyChangeDialog from "@/components/staff/ConfirmPolicyChangeDialog";
import { ApiError } from "@/lib/api/client";
import {
  setBrokerAutoApproval,
  type StaffBrokerDetail,
} from "@/lib/api/staffBrokers";
import type { Locale } from "@/lib/i18n/directory";
import { formatStaffTimestamp, tStaffBroker } from "@/lib/i18n/staff-brokers";

/**
 * Spec §21 "Staff broker UI" item 3: the auto-approval switch with its current
 * state and last changed by/at, wired to the staff-admin-only endpoint.
 *
 * `canConfigure` comes from spec §5's `configure_broker_auto_approval`
 * permission, which the session already reports. It disables the control — it
 * is *not* the security boundary: `IsStaffAdmin` on the endpoint is (spec §2.2).
 * A staff moderator therefore sees the policy, which is what they need for the
 * boats queue, and cannot move it.
 */
export default function AutoApprovalPanel({
  locale,
  broker,
  canConfigure,
  onUpdated,
}: {
  locale: Locale;
  broker: StaffBrokerDetail;
  canConfigure: boolean;
  onUpdated: (broker: StaffBrokerDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const enabled = broker.auto_approve_listings;
  const target = !enabled;

  async function handleConfirm(reason: string) {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await setBrokerAutoApproval(broker.id, {
        enabled: target,
        reason,
      });
      setOpen(false);
      setNotice(
        updated.changed ? null : tStaffBroker(locale, "staff.broker.no_change"),
      );
      onUpdated(updated);
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
      aria-labelledby="auto-approval-heading"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md"
    >
      <h2
        id="auto-approval-heading"
        className="font-title-lg text-title-lg text-primary"
      >
        {tStaffBroker(locale, "staff.broker.auto_approval")}
      </h2>
      <p
        data-testid="auto-approval-state"
        className="mt-space-xs font-title-md text-title-md text-on-surface"
      >
        {tStaffBroker(
          locale,
          enabled
            ? "staff.broker.auto_approval.on"
            : "staff.broker.auto_approval.off",
        )}
      </p>

      <p
        data-testid="auto-approval-last-changed"
        className="mt-space-xs font-body-sm text-on-surface-variant"
      >
        {broker.auto_approve_changed_at === null
          ? tStaffBroker(locale, "staff.broker.auto_approval.never_changed")
          : `${tStaffBroker(locale, "staff.broker.auto_approval.last_changed")}: ${
              broker.auto_approve_changed_by?.full_name ||
              broker.auto_approve_changed_by?.email ||
              ""
            } — ${formatStaffTimestamp(locale, broker.auto_approve_changed_at)}`}
      </p>

      {notice ? (
        <p role="status" className="mt-space-xs font-body-sm text-on-surface-variant">
          {notice}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canConfigure || open}
        onClick={() => {
          setError(null);
          setNotice(null);
          setOpen(true);
        }}
        className="mt-space-sm rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md text-on-primary disabled:opacity-50"
      >
        {tStaffBroker(
          locale,
          target
            ? "staff.broker.auto_approval.enable"
            : "staff.broker.auto_approval.disable",
        )}
      </button>

      {canConfigure ? null : (
        <p className="mt-space-xs font-body-sm text-on-surface-variant">
          {tStaffBroker(locale, "staff.broker.auto_approval.readonly")}
        </p>
      )}

      {open ? (
        <ConfirmPolicyChangeDialog
          locale={locale}
          title={tStaffBroker(
            locale,
            "staff.broker.auto_approval.confirm_title",
          )}
          body={tStaffBroker(
            locale,
            target
              ? "staff.broker.auto_approval.confirm_enable"
              : "staff.broker.auto_approval.confirm_disable",
          )}
          submitting={submitting}
          error={error}
          onConfirm={handleConfirm}
          onCancel={() => {
            setOpen(false);
            setError(null);
          }}
        />
      ) : null}
    </section>
  );
}

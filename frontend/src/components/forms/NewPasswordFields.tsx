"use client";

import { useState } from "react";

import { useT } from "@/i18n/client";

/**
 * A new password typed twice, with a show/hide switch. The confirmation field
 * carries a custom validity message while the two differ, so the browser blocks
 * the form submit and points at the mismatch like any other required field.
 */
export default function NewPasswordFields({
  value,
  onChange,
  label,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  inputClassName: string;
}) {
  const t = useT();
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const mismatch = confirm !== "" && confirm !== value;
  const type = visible ? "text" : "password";

  return (
    <div className="space-y-space-md">
      <label className="block font-label-md text-label-md">
        {label} <span aria-hidden="true" className="text-error">*</span>
        <input className={inputClassName} type={type} autoComplete="new-password" required value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
      <label className="block font-label-md text-label-md">
        {t("auth.password.confirm")} <span aria-hidden="true" className="text-error">*</span>
        <input
          className={inputClassName}
          type={type}
          autoComplete="new-password"
          required
          value={confirm}
          aria-invalid={mismatch}
          ref={(input) => input?.setCustomValidity(mismatch ? t("auth.password.mismatch") : "")}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      {mismatch ? (
        <p role="alert" className="font-body-sm text-error">
          {t("auth.password.mismatch")}
        </p>
      ) : null}
      <label className="flex items-center gap-space-xs font-body-sm">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        {t("auth.password.show")}
      </label>
    </div>
  );
}

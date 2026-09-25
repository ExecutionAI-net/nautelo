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

  const toggleLabel = t(visible ? "auth.password.hide" : "auth.password.show");

  return (
    <div className="space-y-space-md">
      <label className="block font-label-md text-label-md">
        {label} <span aria-hidden="true" className="text-error">*</span>
        <div className="relative">
          <input className={`${inputClassName} pr-10`} type={type} autoComplete="new-password" required value={value} onChange={(e) => onChange(e.target.value)} />
          <button
            type="button"
            aria-label={toggleLabel}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-on-surface-variant hover:text-primary"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              {visible ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
      </label>
      <label className="block font-label-md text-label-md">
        {t("auth.password.confirm")} <span aria-hidden="true" className="text-error">*</span>
        <div className="relative">
          <input
            className={`${inputClassName} pr-10`}
            type={type}
            autoComplete="new-password"
            required
            value={confirm}
            aria-invalid={mismatch}
            ref={(input) => input?.setCustomValidity(mismatch ? t("auth.password.mismatch") : "")}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button
            type="button"
            aria-label={toggleLabel}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-on-surface-variant hover:text-primary"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              {visible ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
      </label>
      {mismatch ? (
        <p role="alert" className="font-body-sm text-error">
          {t("auth.password.mismatch")}
        </p>
      ) : null}
    </div>
  );
}

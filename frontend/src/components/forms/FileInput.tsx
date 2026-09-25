"use client";

import { useId } from "react";

import { useT } from "@/i18n/client";

/**
 * A styled file-picker trigger. A bare `<input type="file">`'s own button
 * shows the browser's OS-localized label ("Dosya Seç" on a Turkish Chrome,
 * "Choose File" on an English one) which our own i18n has no control over;
 * this hides that native button (still present, still keyboard/AT reachable)
 * behind a `<label>` styled and worded from our own translations instead.
 */
export default function FileInput({
  accept,
  required,
  fileName,
  onChange,
  ariaLabel,
}: {
  accept: string;
  required?: boolean;
  fileName?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  ariaLabel: string;
}) {
  const t = useT();
  const id = useId();
  return (
    <div className="mt-space-xs flex flex-wrap items-center gap-space-sm">
      <label
        htmlFor={id}
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-space-sm py-space-xs font-body-md hover:bg-surface-container-low"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          upload_file
        </span>
        {t("auth.org_register.choose_file")}
      </label>
      <input id={id} type="file" className="sr-only" accept={accept} required={required} aria-label={ariaLabel} onChange={onChange} />
      <span className="font-body-sm text-on-surface-variant">{fileName || t("auth.org_register.no_file_chosen")}</span>
    </div>
  );
}

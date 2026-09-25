"use client";

import Link from "@/components/layout/LocaleLink";
import { useT } from "@/i18n/client";

export default function ForbiddenScreen({ reason }: { reason?: string }) {
  const t = useT();
  return (
    <section
      role="alert"
      className="mx-auto flex max-w-md flex-col items-start gap-space-md p-space-lg"
    >
      <h1 className="font-headline-md text-headline-md text-primary">
        {t("auth.forbidden.title")}
      </h1>
      <p className="font-body-md text-on-surface-variant">
        {reason ?? t("auth.forbidden.default_reason")}
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md text-on-primary"
      >
        {t("auth.forbidden.back_home")}
      </Link>
    </section>
  );
}

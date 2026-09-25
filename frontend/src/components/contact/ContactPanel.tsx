"use client";

import { useT } from "@/i18n/client";
// A CLIENT component on purpose, and it is a privacy requirement rather than a
// preference (spec 16: never place the unblurred value in "page source … or
// preloaded JSON"). A server component would serialize whatever it fetched into
// the RSC payload embedded in the HTML — and it could not identify the viewer
// anyway, because the access token lives in browser memory (lib/api/client.ts).
import { useEffect, useState } from "react";

import {
  CONTACT_ACCESS_REFRESH_EVENT,
  fetchContactAccess,
  type ContactAccess,
  type ContactAccessRefreshDetail,
  type ContactTargetType,
} from "@/lib/api/contacts";
import { useSession } from "@/lib/auth/session";
import { type Locale } from "@/lib/i18n/contact";

interface ContactPanelProps {
  targetType: ContactTargetType;
  targetId: string;
  locale: Locale;
}

export default function ContactPanel({
  targetType,
  targetId,
  locale,
}: ContactPanelProps) {
  const t = useT();
  // The session, not just the token: on a fresh page load lib/api/client.ts's
  // access token is empty and SessionProvider is still trading the HttpOnly
  // refresh cookie for a new one (session.tsx's `loading` starts true). Asking
  // before that finishes sends an UNAUTHENTICATED request, which this endpoint
  // answers 200 LOCKED — so apiFetch's 401-refresh-retry never fires and a
  // grant holder would sit on a locked panel until they reloaded. Waiting for
  // `loading` to clear is the fix; `viewerId` in the dependency list is what
  // re-asks when somebody logs in or out without a full page load.
  const { session, loading: sessionLoading } = useSession();
  const viewerId = session?.user?.id ?? null;

  const [access, setAccess] = useState<ContactAccess | null>(null);
  const [failed, setFailed] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchContactAccess(targetType, targetId);
        if (!cancelled) {
          setAccess(next);
          setFailed(false);
        }
      } catch {
        // A failed request is NOT "locked": saying so would give the reader a
        // false reason. The panel says it could not load instead.
        if (!cancelled) {
          setAccess(null);
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId, sessionLoading, viewerId, reloadTick]);

  useEffect(() => {
    function onRefresh(event: Event) {
      const detail = (event as CustomEvent<ContactAccessRefreshDetail>).detail;
      if (detail?.targetType === targetType && detail?.targetId === targetId) {
        setReloadTick((tick) => tick + 1);
      }
    }
    window.addEventListener(CONTACT_ACCESS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(CONTACT_ACCESS_REFRESH_EVENT, onRefresh);
  }, [targetType, targetId]);

  return (
    <section
      aria-labelledby="contact-heading"
      className="rounded-xl border border-outline-variant p-space-md"
    >
      <h2
        id="contact-heading"
        className="flex items-center gap-space-xs font-title-lg text-title-lg text-primary"
      >
        {/* Decorative only — the lock state is also stated in words below, so
            spec 29.6's "readable without relying on hover" holds. */}
        <span className="material-symbols-outlined" aria-hidden="true">
          {access?.state === "GRANTED" ? "lock_open" : "lock"}
        </span>
        {t("contact.heading")}
      </h2>

      {failed ? (
        <p className="mt-space-sm font-body-md text-on-surface-variant" role="status">
          {t("contact.error")}
        </p>
      ) : null}

      {!failed && access === null ? (
        <p className="mt-space-sm font-body-md text-on-surface-variant" aria-busy="true">
          {t("contact.loading")}
        </p>
      ) : null}

      {access?.state === "UNAVAILABLE" ? (
        <p className="mt-space-sm font-body-md text-on-surface-variant">
          {t("contact.unavailable")}
        </p>
      ) : null}

      {access?.state === "LOCKED" ? (
        <>
          <dl className="mt-space-sm space-y-space-xs">
            <div>
              <dt className="font-body-sm text-on-surface-variant">
                {t("contact.email_label")}
              </dt>
              {/* The value is masked server-side (c****@domain); the secret never
                  reaches this browser, so it is shown as-is with no CSS hiding. */}
              <dd className="select-none font-body-md text-on-surface">
                {access.email_mask}
              </dd>
            </div>
            <div>
              <dt className="font-body-sm text-on-surface-variant">
                {t("contact.phone_label")}
              </dt>
              <dd className="select-none font-body-md text-on-surface">
                {access.phone_mask}
              </dd>
            </div>
          </dl>
          <p className="mt-space-sm font-body-sm text-on-surface-variant">
            {t("contact.locked_explanation")}
          </p>
          <p className="mt-space-xs font-body-sm text-on-surface-variant">
            {t("contact.blur_reason")}
          </p>
        </>
      ) : null}

      {access?.state === "GRANTED" ? (
        <>
          <p className="mt-space-sm font-body-sm text-on-surface-variant">
            {t("contact.unlocked")}
          </p>
          <dl className="mt-space-sm space-y-space-xs">
            <div>
              <dt className="font-body-sm text-on-surface-variant">
                {t("contact.email_label")}
              </dt>
              <dd className="font-body-md">
                <a className="text-secondary underline" href={`mailto:${access.email}`}>
                  {access.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-body-sm text-on-surface-variant">
                {t("contact.phone_label")}
              </dt>
              <dd className="font-body-md">
                <a className="text-secondary underline" href={`tel:${access.phone}`}>
                  {access.phone}
                </a>
              </dd>
            </div>
            {access.website_url ? (
              <div>
                <dt className="font-body-sm text-on-surface-variant">
                  {t("contact.website_label")}
                </dt>
                <dd className="font-body-md">
                  <a
                    className="text-secondary underline"
                    href={access.website_url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {access.website_url}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
          {/* Guarded, not assumed: `granted_at` is null on the staff-bypass
              path (spec §5), where there is no grant and therefore no date to
              show. An unguarded .slice() here would throw and unmount the whole
              panel for every staff viewer. */}
          {access.granted_at ? (
            <p className="mt-space-sm font-body-sm text-on-surface-variant">
              {t("contact.granted_on")}{" "}
              <time dateTime={access.granted_at}>{access.granted_at.slice(0, 10)}</time>
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

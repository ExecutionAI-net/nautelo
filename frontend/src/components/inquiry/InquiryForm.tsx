"use client";

import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n";
// THE shared inquiry form (spec 15.1: "Component name should be equivalent to
// InquiryForm; do not create broker-, professional- and listing-specific
// copies"). It is context-agnostic on purpose: Phases 19 and 20 mount this same
// file on /boats/<slug>/ and /brokers/<slug>/ with a different `context` prop.
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import {
  contactTargetTypeForContext,
  requestContactAccessRefresh,
} from "@/lib/api/contacts";
import {
  createInquiryDraft,
  resolveInquiryDraft,
  submitInquiry,
  type InquiryConfig,
  type InquiryContextRef,
} from "@/lib/api/inquiries";
import {
  clearDraftToken,
  readDraftToken,
  storeDraftToken,
} from "@/lib/inquiry/draft-storage";
import { formatInquiryMessage } from "@/lib/i18n/inquiry";
import type { Locale } from "@/lib/i18n/directory";
import { useSession } from "@/lib/auth/session";
import { localizePath } from "@/lib/i18n/localePath";

interface InquiryFormProps {
  context: InquiryContextRef;
  config: InquiryConfig;
  locale: Locale;
}

/** Backend error code -> message key. Every code this phase can return has an
 *  entry; anything unrecognised falls back to the generic message rather than
 *  printing the backend's own English at a person (spec 37). */
const ERROR_MESSAGE_KEYS: Record<string, string> = {
  rate_limited: "inquiry.error.rate_limited",
  recipient_unavailable: "inquiry.error.recipient_unavailable",
  consent_required: "inquiry.error.consent_required",
  self_inquiry_not_allowed: "inquiry.error.self_inquiry",
  inquiry_initiator_not_allowed: "inquiry.business_cannot_start",
  feature_disabled: "inquiry.error.feature_disabled",
  email_verification_required: "inquiry.verify_email_first",
  draft_expired: "inquiry.error.draft_expired",
  invalid_draft: "inquiry.error.draft_expired",
  validation_error: "inquiry.error.validation",
};

const FIELD_CLASS =
  "mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md";

export default function InquiryForm({ context, config, locale }: InquiryFormProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading } = useSession();

  const user = session?.user ?? null;
  const isSignedIn = Boolean(session?.authenticated && user);
  const isVerified = Boolean(user?.email_verified);
  // Only private sellers start conversations; broker and professional accounts only reply.
  const isBusiness = isSignedIn && user?.primary_role !== "PRIVATE_SELLER";

  // `context` arrives as an object literal from the page (Task 13), so it is a
  // NEW object on every render. Depending on it directly would make the restore
  // effect's dependency array change every render - which eslint's
  // react-hooks/exhaustive-deps correctly flags, and which would re-run the
  // effect forever but for the `restored` ref guard. Memoising on the three
  // primitives gives a genuinely stable reference, so the guard is a belt and
  // the deps are honest.
  const contextRef = useMemo(
    () => ({ type: context.type, id: context.id, label: context.label }),
    [context.type, context.id, context.label],
  );

  const defaultSubject = formatInquiryMessage(
    t("inquiry.subject_default"),
    { context: contextRef.label },
  );

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Declared BEFORE the effects that call it. A `const` is in the temporal dead
  // zone until its initialiser runs, and although an effect body executes after
  // render (so this would work at runtime), eslint's no-use-before-define and
  // exhaustive-deps both object - and `pnpm lint` is a gate on this task.
  const messageFor = useCallback(
    (caught: unknown): string => {
      if (caught instanceof ApiError) {
        const fieldMessages = Object.values(caught.fields)
          .flat()
          .map((field) => field.message);
        if (caught.code === "validation_error" && fieldMessages.length > 0) {
          return fieldMessages.join(" ");
        }
        const key = ERROR_MESSAGE_KEYS[caught.code];
        if (key) return t(key as MessageKey);
      }
      return t("inquiry.error.generic");
    },
    [locale],
  );

  // Prefill the name and phone from the profile once the session resolves,
  // without clobbering something the person has already typed (spec 15.1:
  // "prefilled from profile", not "locked to profile") - both stay editable.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !user) return;
    prefilled.current = true;
    setFullName((current) => current || user.full_name);
    setPhone((current) => current || user.phone_number || "");
  }, [user]);

  // Spec 15.2's return half: restore the saved draft once, after the person is
  // signed in and verified. It never sends - it fills the form and asks.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || loading || !isSignedIn || !isVerified) return;
    const token = readDraftToken(contextRef);
    if (!token) return;
    restored.current = true;
    void (async () => {
      try {
        const draft = await resolveInquiryDraft(token);
        setFullName((current) => draft.full_name || current);
        setPhone(draft.phone);
        setSubject(draft.subject || defaultSubject);
        setMessage(draft.message);
        setNotice(t("inquiry.draft_restored"));
      } catch (caught) {
        setError(messageFor(caught));
      } finally {
        clearDraftToken(contextRef);
      }
    })();
  }, [
    contextRef,
    defaultSubject,
    isSignedIn,
    isVerified,
    loading,
    locale,
    messageFor,
  ]);

  async function handleGuestSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { draft_token } = await createInquiryDraft({
        context_type: contextRef.type,
        context_id: contextRef.id,
        full_name: fullName,
        phone,
        subject,
        message,
      });
      storeDraftToken(contextRef, draft_token);
    } catch (caught) {
      // A draft that could not be saved is not a reason to block sign-in; the
      // person retypes. Surfacing the failure would be noise at the exact
      // moment they are being sent elsewhere.
      void caught;
    } finally {
      setBusy(false);
    }
    // `pathname` is this app's own route, so it is always a single-slash local
    // path - exactly what lib/auth/next-url.ts's allowlist accepts (spec 33.1:
    // "Allowlist local return URLs; prevent open redirects").
    router.push(localizePath(`/login/?next=${encodeURIComponent(pathname)}`, locale));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    if (!isSignedIn) {
      await handleGuestSubmit();
      return;
    }
    if (!isVerified) {
      setError(t("inquiry.verify_email_first"));
      return;
    }
    if (!privacyConsent) {
      setError(t("inquiry.error.consent_required"));
      return;
    }

    setBusy(true);
    try {
      await submitInquiry({
        context_type: contextRef.type,
        context_id: contextRef.id,
        full_name: fullName,
        email: user!.email,
        phone,
        subject,
        message,
        privacy_policy_version: config.privacy_policy_version,
        privacy_consent: privacyConsent,
        marketing_consent: marketingConsent,
        company_website: honeypot,
      });
      // Spec 15.5 returns next_url, and this form deliberately does NOT follow
      // it: the conversation page is Phase 19/20's and does not exist yet, so
      // navigating there would replace a success with a 404. See the plan's
      // ruling and Known Limitations.
      setSent(true);
      // Spec 16: "After successful send, refetch contact authorization; do not
      // rely on client-side unblur alone." This asks Phase 7's panel to re-ask
      // the server; it never unlocks anything by itself.
      //
      // `contextRef`, not the raw `context` prop: Phase 6's form memoizes the
      // context into `contextRef` and every other call site in the file
      // (the draft token, the submit payload, the label) reads it. Mixing the
      // two spellings in one function is how the two drift apart later.
      const contactTarget = contactTargetTypeForContext(contextRef.type);
      if (contactTarget) {
        requestContactAccessRefresh(contactTarget, contextRef.id);
      }
      setMessage("");
      setPrivacyConsent(false);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }

  const consentLabel = formatInquiryMessage(
    t("inquiry.privacy_consent"),
    { version: config.privacy_policy_version },
  );

  if (isBusiness) {
    return (
      <section aria-labelledby="inquiry-heading" className="mt-space-xl">
        <h2 id="inquiry-heading" className="font-title-lg text-title-lg text-primary">
          {t("inquiry.heading")}
        </h2>
        <p className="mt-space-md font-body-md text-on-surface-variant">{t("inquiry.business_cannot_start")}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="inquiry-heading" className="mt-space-xl">
      <h2
        id="inquiry-heading"
        className="font-title-lg text-title-lg text-primary"
      >
        {t("inquiry.heading")}
      </h2>

      <form onSubmit={handleSubmit} className="mt-space-md space-y-space-md" noValidate>
        <label className="block font-label-md text-label-md" htmlFor="inquiry-full-name">
          {t("inquiry.full_name")}
          <input
            id="inquiry-full-name"
            name="full_name"
            autoComplete="name"
            minLength={config.limits.full_name.min}
            maxLength={config.limits.full_name.max}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        {isSignedIn ? (
          <>
            <label className="block font-label-md text-label-md" htmlFor="inquiry-email">
            {t("inquiry.email")}
            <input
              id="inquiry-email"
              name="email"
              type="email"
              readOnly
              value={user?.email ?? ""}
              className={`${FIELD_CLASS} bg-surface-container`}
            />
          </label>
          {/* Spec 15.1 asks for an "Update in account" affordance beside the
              read-only email. There is no /account/ PAGE yet - frontend/src/app
              holds only 403, health, login, professionals, services and
              verify-email - and linking to a 404 would be worse than explaining
              the rule in place, so this is text until Phase 16 or 20 builds the
              account screen. Recorded in Known Limitations. `GET|PATCH
              /api/v1/account/` (Phase 3) already exists behind it. */}
          <p className="font-body-sm text-on-surface-variant">
            {t("inquiry.email_hint")}
          </p>
  
            </>
        ) : (
          <p className="font-body-sm text-on-surface-variant">{t("inquiry.guest_hint")}</p>
        )}

        <label className="block font-label-md text-label-md" htmlFor="inquiry-phone">
          {t("inquiry.phone")}
          <input
            id="inquiry-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={config.limits.phone_max}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-describedby="inquiry-phone-hint"
            className={FIELD_CLASS}
          />
        </label>
        <p id="inquiry-phone-hint" className="font-body-sm text-on-surface-variant">
          {t("inquiry.phone_hint")}
        </p>

        <label className="block font-label-md text-label-md" htmlFor="inquiry-subject">
          {t("inquiry.subject")}
          <input
            id="inquiry-subject"
            name="subject"
            minLength={config.limits.subject.min}
            maxLength={config.limits.subject.max}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className="block font-label-md text-label-md" htmlFor="inquiry-message">
          {t("inquiry.message")}
          <textarea
            id="inquiry-message"
            name="message"
            rows={6}
            minLength={config.limits.message.min}
            maxLength={config.limits.message.max}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        {/* Spec 15.1's honeypot. Off-screen rather than display:none, because
            some bots skip hidden inputs; aria-hidden and tabIndex -1 keep it
            away from keyboard and screen-reader users entirely. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="inquiry-company-website">Company website</label>
          <input
            id="inquiry-company-website"
            name={config.honeypot_field}
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        <label className="flex items-start gap-space-xs font-body-sm" htmlFor="inquiry-privacy">
          <input
            id="inquiry-privacy"
            name="privacy_consent"
            type="checkbox"
            checked={privacyConsent}
            onChange={(event) => setPrivacyConsent(event.target.checked)}
          />
          {consentLabel}
        </label>

        <label className="flex items-start gap-space-xs font-body-sm" htmlFor="inquiry-marketing">
          <input
            id="inquiry-marketing"
            name="marketing_consent"
            type="checkbox"
            checked={marketingConsent}
            onChange={(event) => setMarketingConsent(event.target.checked)}
          />
          {t("inquiry.marketing_consent")}
        </label>

        {error ? (
          <p role="alert" className="font-body-sm text-error">
            {error}
          </p>
        ) : null}
        {sent || notice ? (
          <p role="status" className="font-body-sm text-primary">
            {sent ? formatInquiryMessage(t("inquiry.sent"), { context: contextRef.label }) : notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || loading}
          className="w-full rounded-lg bg-primary p-space-sm font-label-md text-label-md text-on-primary disabled:opacity-50"
        >
          {busy
            ? t("inquiry.sending")
            : isSignedIn
              ? t("inquiry.send")
              : t("inquiry.sign_in_to_send")}
        </button>
      </form>
    </section>
  );
}

# NAUTA test report 2 - broker, professional and staff (round 2)

Date: 2026-09-21. Extends [test1.md](test1.md) (private seller).

## 0. How this round was done - read this first

The three test accounts (broker, professional, staff) were handed over, but **the assistant is not allowed to
sign in by typing a password**, so the live site could not be used as those roles. What was done instead:

1. **Live dev site, no sign-in needed** - page and API availability, validation behaviour, and what an
   unauthenticated visitor sees (section 2).
2. **Full role journeys as automated end-to-end scenarios** against the real backend (real HTTP API, real
   database, real permission code; only Stripe and object storage are faked). They are committed as
   `backend/accounts/tests/test_role_scenarios.py`, so they run in CI on every change (section 3).

**Not covered** (needs a signed-in browser): visual layout and UX of the broker, professional and staff dashboards,
real Stripe checkout, real emails, real image upload to the bucket, mobile layouts. To cover them, sign in once
in the Chrome window as each role and ask for a UX pass; no password is then needed. The passwords posted in
chat should be changed.

Order requested and followed: broker, professional, staff.

## 1. Bugs found and fixed in this round

| ID | Severity | Role | Finding | Fix |
| --- | --- | --- | --- | --- |
| R2-1 | **S1** | Professional team | A team member with the "Messages" permission could not see or answer the organization's messages: professional conversations were visible to the owner only, and notifications went to the owner only. The whole "team and roles" feature was cosmetic for messages. | Conversation list, thread access, and in-app notifications now include active members with `can_read_messages` (owner still always included). |
| R2-2 | **S1** | Professional | An owner whose email was **not verified** could open the Stripe membership checkout. A card would be collected for an unverified (possibly fake) mailbox, which enables card testing. | Checkout now requires a verified email (the broker checkout already did). |
| R2-3 | S2 | Both | Organization registration accepted markup in the business name (`<script>...`) and a junk phone number (`abc`). | Names with `<`/`>` are refused; phone must contain at least 6 digits and only phone characters. |

## 2. Live dev site (unauthenticated)

| Check | Result |
| --- | --- |
| `/`, `/register/`, `/register/professional/`, `/register/broker/`, `/accept-invite/`, `/brokers/`, `/services/professionals/`, `/pricing/`, `/login/` | 200 |
| Dashboard routes without a session (`/dashboard/broker/`, `/dashboard/service-provider/team/`) | 200 shell (the page then requires a session client-side) |
| `GET /api/v1/provider/team/`, `/provider/membership/` without token | 401 |
| `POST /auth/invitations/preview/` with a bad token | 400 `invalid_invitation` |
| `POST /auth/register/organization/` with `org_type=STAFF` and empty body | 400, per-field errors; staff cannot be self-registered |
| `GET /api/v1/pricing/` | 3 broker plans, **0 listing packages, no professional plan** (Stripe products not created yet, so nothing is on sale) |
| Deploy window | About 2 minutes of `502 Bad Gateway` right after a merge while the new version starts. Users would see errors during every deploy. |

## 3. Scenario results (all pass after the fixes above)

### Professional journey
Register organization (owner gets the PROFESSIONAL role and an ADMIN seat) -> verify email -> sign in -> empty
profile cannot be submitted and the API says why (`profile_incomplete`) -> fill profile, add a service, upload a
logo -> complete but unpaid is refused with a different reason (`subscription_required`) -> membership page
reports the trial as available -> Stripe trial confirmation (no charge) sets `TRIALING` -> submit succeeds
(`PENDING`) -> not public until staff activate -> staff activate -> public page shows logo and team ->
invite a manager by email (new address registers into the role) -> manager sees the team but cannot invite ->
visitor sends a message -> **owner and manager both see it** (after R2-1) and the manager replies -> visitor
sees the reply -> removing the manager returns them to a private-seller account and closes their access.

### Broker journey
Register (plan required) -> verify -> onboarding works while DRAFT (profile, billing) -> incomplete and unpaid
submits refused with the right reasons -> logo upload -> trial confirmed -> submit -> not public -> staff
approve -> public page with logo -> invite a manager -> **seat limit (2) blocks a third invite** -> manager cannot
invite -> visitor message answered by the manager, owner also sees it -> staff suspend: public page goes 404
while the owner can still open billing (a lapsed brokerage can always pay).

### Staff boundaries
Non-staff get 403 on staff lists; staff addresses cannot be invited into an organization; organization
registration on an existing address is refused.

## 3b. Live broker session (2026-09-21, signed in by the owner in Chrome)

Account: broker admin of "hakan broker" (brokerage ACTIVE, ADMIN seat, all three capabilities).

| Check | Result |
| --- | --- |
| Session | role BROKER, membership ADMIN with edit/team/messages, **email not verified** |
| Permissions the session reports | only `browse_public_content` |
| Dashboard home (`/dashboard/broker/`) | loads; all counters 0 |
| Profile, Team, Subscription pages | **all fail**: API answers `403 email_not_verified`, the screens say "The profile could not be loaded. Editing needs an administrator role." / "The account details could not be loaded." (wrong cause) |
| "Add vessel" (dashboard button and empty-state link) | leads to **"Access denied - your account does not have permission"** (same hidden cause) |
| Messages / Leads | load, empty; "Leads" is just Messages pre-filtered to "Listing inquiries", with a bare "No conversations match this filter." |
| Public page `/brokers/hakan-broker/` | 200; empty tagline/about/logo, country IT |

Findings:

| ID | Sev | Finding | Status |
| --- | --- | --- | --- |
| R2-13 | **S1** | A brokerage created by staff has an admin who is not email-verified, and **every organization screen is dead** with misleading messages. A real user would conclude the product is broken or that they lack rights. | Fixed for the UI in PR 365: every dashboard now shows a "Verify your email" banner with a resend button. Still open: staff-created accounts should be created verified (or get the verification mail automatically). |
| R2-14 | S2 | "Access denied" for a missing capability never says what to do. Same for the team/profile error texts. | Fixed with this PR: the denied screen and the broker error texts now name the unverified email. |
| R2-15 | S3 | Empty states give no next step: Leads and Messages say only "No conversations match this filter"; dashboard "Mandate inventory" fine. | Add guidance (e.g. "Share your public page", "Add your first vessel"). |
| R2-16 | S3 | The browser viewport in this session was small (about 1045x450 usable) and the dashboard sidebar consumed a large share; not judged. | Needs a desktop-size pass. |

Blocked until the broker account is verified: profile completion, logo upload, team invitation, subscription and
trial checkout, adding a vessel, receiving and answering a message. The backend scenario in section 3 covers
those steps; the live UI still needs a pass.

## 3c. Live broker session after email verification (2026-09-21)

| Step | Result |
| --- | --- |
| Session | verified; permissions now include `create_broker_listing` |
| Profile page | loads; completeness 33% (tagline, about, city, specialties missing) |
| Fill city, tagline, about, specialties in the form and **Save** | works; completeness 100% |
| **Logo upload** (1280 px JPEG) to the real S3 bucket | works (presigned PUT + CORS OK); preview shown; "Image saved." |
| **Cover upload** | works |
| Public page `/brokers/hakan-broker/` | shows logo, city, tagline, about and specialties, all from the real signed S3 URL |
| Subscription page | loads; button "Start your 30-day free trial" (trial available, plan Boutique Broker EUR 290) |
| Trial checkout | "Checkout is not available yet" (API 503 `subscription_unavailable`): expected, Stripe prices are not configured |
| Team API | list works; inviting the account's own address -> `already_member`; bad email and bad role -> field errors. No invitation was sent to any outside address. |
| Add vessel form | loads (6 sections, 20 photos / 1 video for brokers) |
| Messages / leads | empty; a visitor message round trip needs a second account |

New findings:

| ID | Sev | Finding |
| --- | --- | --- |
| R2-17 | S2 | The subscription page is contradictory: a "NOT SUBSCRIBED" chip next to "CURRENT PLAN - ACTIVE", the plan card says "Currently Enrolled" although nothing is paid, the text says "billing is not self-service yet" right below a self-service trial button, and the other tiers say "Request this tier" (no way to do that). |
| R2-18 | S2 | This brokerage is **ACTIVE with no subscription and a 33% profile**: staff activation does not check billing or completeness (R2-6 confirmed live). |
| R2-19 | S3 | Fixed here: the broker "Add vessel" form was titled "Sell your boat" (the private-seller wording). It now says "Add a vessel". The lead paragraph and some labels still use seller wording. |
| R2-20 | S3 | The uploaded **cover image is not shown** anywhere on the public broker page (the header is a plain gradient). Either use it as the header or drop the field. |
| R2-21 | S3 | The site navigation for a broker still shows private-seller items ("List my boat", "My listings") next to "Fleet" and "Broker dashboard". |
| R2-22 | S3 | Confirmed live: the staff-created brokerage admin is not flagged as owner (R2-10). |
| R2-23 | S3 | Clicking a button by reference in the automation did not fire; a real click did. Not a product bug, noted for future test runs. |

## 3d. Live professional session (2026-09-21, signed in by the owner in Chrome)

Account: owner of "Professional Hakan Org" (role PROFESSIONAL, profile DRAFT), **email not verified**.

| Check | Result |
| --- | --- |
| Session | role PROFESSIONAL, permissions only `browse_public_content`, no broker seats |
| Profile API | loads; completeness 29% (short description, description, city, service area, services missing); logo and cover empty |
| Membership API | loads; status INACTIVE, no plan, `trial_available: false`, `trial_days: 0` (no professional plan configured) |
| Team and invitations API | `403 email_not_verified` (the banner from PR 365 explains it; the team screen text now names the cause too) |
| Services, conversations | empty lists |
| Membership checkout | `503 membership_unavailable` ("not open for sign-up yet"): expected, no Stripe plan |
| Public page | 404 while DRAFT: correct |

New findings:

| ID | Sev | Finding |
| --- | --- | --- |
| R2-24 | S2 | Self-registered professional accounts also stay unverified until the mail link is opened, so the whole organization area is locked (same as R2-4). A verified pass (profile save, logo, services, team) is still needed: verify the email and ask again. |
| R2-25 | S3 | The professional team screen said only "The team could not be loaded." Fixed: it now names the unverified email as a likely cause. |
| R2-26 | S3 | The membership state reports `trial_available: false` and `trial_days: 0` when no plan exists, while checkout answers 503; the page should say "membership not open yet" rather than showing a dead state. |

## 4. Open findings (not fixed - need a decision or a signed-in UX pass)

| ID | Sev | Finding | Suggestion |
| --- | --- | --- | --- |
| R2-4 | S2 | Sign-in works **before** the email is verified (the API returns a token). Most screens then work, some answer 403 (team), others 200 (profile, membership). Inconsistent; a first-time owner gets no clear "verify your email" state. | Decide one rule: either block sign-in until verified, or show a persistent "verify your email" banner and gate every organization screen the same way. |
| R2-5 | S2 | A newly registered brokerage that is DRAFT/PENDING cannot open its **dashboard home** (403) - only profile, team, billing and invitations work. | Make the home an onboarding checklist (profile, plan, submit) for DRAFT/PENDING brokerages. |
| R2-6 | S2 | Staff can activate an organization that has **no live subscription** (no check between approval and billing). | Warn or refuse in the staff status action when the subscription is not TRIALING/ACTIVE. |
| R2-7 | S3 | Country accepts any two letters (FR, ZZ). The product covers Spain and Italy. | Restrict to the supported countries (and drive it from settings). |
| R2-8 | S3 | Public professional and broker cards show the team member's **email address** publicly by design (requested). It will attract scraping and spam. | Keep, but consider a contact button instead of raw addresses, or the existing masked-contact pattern. |
| R2-9 | S3 | Broker subscription events send **no notifications** (professionals do): trial started, payment failed, suspended. | Add broker notification types. |
| R2-10 | S3 | Existing brokerages created before this change have **no owner** flag, so nobody is protected from removal. | Data migration: mark the earliest ADMIN as owner, or let staff set it. |
| R2-11 | S3 | The deploy 502 window (section 2). | Rolling or blue/green deploy, or a friendly maintenance page. |
| R2-12 | S3 | Flaky test: `test_concurrent_registration_for_the_same_email_yields_one_conflict_not_a_500` fails intermittently (expects 409, gets 400 when the second request runs after the first commits). Not a product bug; it made two CI runs red. | Accept `{400, 409}` in that test. |

## 5. Not verified anywhere yet

Real Stripe (products and prices are not configured, so checkout answers "not available"), trial-to-paid
conversion and card failure timing, real email delivery, uploading to the real bucket and CORS on the presigned
PUT, invitation email in Italian and Spanish, load and abuse testing, mobile and accessibility passes for the new
screens (register, accept invite, team, billing, profile checklist).

## 6. Next

1. Sign in once per role in the Chrome window, then run the UX pass (layout, wording, comparison with competitors).
2. Create the Stripe products and prices so the trial flow can be tried for real in test mode.
3. Decide R2-4, R2-5 and R2-6.

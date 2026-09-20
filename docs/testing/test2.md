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

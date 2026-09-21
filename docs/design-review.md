# Design comparison - Stitch package vs the platform (2026-09-21)

Source: `stitch_nauta_nautical_marketplace (3).zip` (51 screens). Method: every screen mapped to a route, then section headings of the design compared with the built page for the screens that changed most (broker, professional, staff).

Every screen has a built counterpart, except the items below.

| Design screen | Gap | Action |
| --- | --- | --- |
| Broker subscription: Payment Instruments, Tax and Legal Entity, Billing History and Official Tax Invoices | Not present | **Done**: "Payment methods, invoices and tax details" button opens the Stripe customer portal (`POST .../subscription/portal/`, `POST provider/membership/portal/`), for brokers and professionals |
| Broker subscription: MLS Feed Status, syndication | Out of scope (no feeds) | Left out |
| Service request detail with commercial proposal | Requests are served by the message thread | Left as is; a proposal workflow is a product decision |
| Broker team management | Built (team page + invitations) | Extended beyond the design (roles, flags, seat limit) |
| Public broker profile: broker team, active listings | Built | Cover image field not shown (R2-20) |
| Staff verification desk | Built as moderation queue and broker/provider status actions | - |

Not in the package but added from competitor research: `/valuation`, `/for-brokers` (see [competitor-boat24.md](competitor-boat24.md)).

## Public pages pass (2026-09-21, later)

| Page | Finding | Action |
| --- | --- | --- |
| Contact | **The form was a dead prototype**: no submission, a fake reference number ("#NAU-2025-9481"), a "response within 4 hours" promise, an invented "end-to-end encrypted" claim, an escrow desk topic and an "Escrow Bonded" badge (escrow is out of scope) | Real form (`POST /api/v1/contact/`, stored in the new `contactdesk` app, visible in Django admin, honeypot, throttled 10/hour, consent required). Escrow and compliance claims removed |
| Financing | Design has a study request form, Spain/Italy leasing overview and a documents list; the page had only the estimator | Added, with cautious wording (no tax-exemption promises, no escrow). The study request uses the same stored contact form |
| Guides | Design shows 7 guides, the dev site has 3 | Content, not code: staff can add guides in the content screen |
| Home, boats, services, brokers, comparison | Section structure matches the design | - |

Requests are stored, not emailed yet (email is not connected). Staff read them in Django admin under Contact requests.

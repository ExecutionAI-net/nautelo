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

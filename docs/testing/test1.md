# NAUTA test report 1 - private seller (round 1)

Environment: dev server `http://108.130.226.143`, Chrome, one private-seller account (the owner's own account).
Date: 2026-09-20. Tester: Claude, driving the real site through the browser plus its own public API.

**Read this first - what this report is and is not.**
Nobody can honestly promise "a million users will find nothing we did not find". This round
exercised the private-seller journey end to end and is a starting list, not a guarantee.
Not covered yet are listed in section 6. Competitor comparison in section 5 is from general
knowledge of those products, not from a fresh side-by-side session.

## 1. What was exercised

| Area | Result |
| --- | --- |
| Page availability (32 URLs) | All respond; 404s are on pages that do not exist for sellers (see F-11) |
| Free listing right | Already consumed by an earlier listing; create page correctly shows "used your free allowance, next on 09/20/2027" |
| Django gift of paid listings (no package, 1, 2, 3 months) | Works after fix F-2; ledger rows carry package, days and limits |
| Draft creation with a paid right | Works; the draft immediately shows 20 photos / 1 video |
| Upload 20 photos + 1 video (real UI file input) | Works; 21st+ photos rejected with "Limit reached: 20 of this type" |
| Photo rules | 512x279 images are rejected (minimum 400x300) - correct, but see F-3 |
| Video (`tekne video test.mp4`, 0.9 MB, 480x864) | Accepted, READY, poster created, stored unchanged (already H.264/MP4). A non-H.264 file was not available, so the transcode path is unverified on the live server |
| Submit for review with 4 paid rights | All four listings reached PENDING_APPROVAL; all four rights became CONSUMED |
| Message to a broker | Delivered; shows in the seller inbox and in Django |
| Message to a professional | Cannot be delivered (F-4) |
| 1, 2 and 3 month publication length | NOT verified: needs staff approval (publication days are applied at approval) |

## 2. Findings - fixed during this round

| ID | Severity | Finding | Fix |
| --- | --- | --- | --- |
| F-1 | Critical | Media endpoints allowed only 120 requests per hour per IP. One listing with 20 photos + video needs 40+ requests, so after two uploads the seller was locked out for **47 minutes** ("Expected available in 2824 seconds") | Raised to 600/hour (PR 354) |
| F-2 | High | A Django superuser without the Staff-admin group was refused the "gift paid listing" action, and the ledger revoke/restore actions | Superusers allowed (PR 353) |

## 3. Findings - open

Severity: **S1** blocks a normal user, **S2** serious, **S3** annoying, **S4** cosmetic.

| ID | Sev | Finding | Suggestion |
| --- | --- | --- | --- |
| F-3 | S2 | Demo seed images are 512x279, below the site's own 400x300 minimum, so seeded listings have no photos: broker and catalogue cards are grey boxes | Re-seed with images of at least 1280x720 |
| F-4 | S1 | Every demo professional profile shows a "Send message" form, but the API answers `409 recipient_unavailable` (the profile has no owner account able to receive). A user types a message and gets no result | Hide the form when the recipient cannot receive, or show the reason |
| F-5 | S2 | Upload counters are stale: "Photos 0/20" and "Videos 0/1" stay while items are already READY; no progress indicator during upload; several rejections show a single alert | Live counters, per-file progress and per-file errors |
| F-6 | S2 | The floating "Save draft / Save changes" bar covers dropdown options and form fields in a short viewport (about 600 px high); mouse selection of options failed there (keyboard worked) | Make the bar non-overlapping or collapsible; test at 1366x768 |
| F-7 | S3 | `/sell/create/` flashes the empty form for a moment, then replaces it with "you used your free allowance" | Resolve eligibility before rendering the form |
| F-8 | S2 | The edit page of a listing that is IN REVIEW shows "DRAFT SAVED", "Save changes" and "Submit for review", and My listings offers only "Edit listing" - there is no visible way to withdraw/close a listing | Status-aware actions: withdraw, close, mark sold |
| F-9 | S2 | At submission the system picks the paid right itself (oldest first). A seller who bought a 3-month right cannot choose to spend it on this listing rather than a 1-month one | Let the seller pick the package at submit (renewal already lets them) |
| F-10 | S3 | Django gift form: "No package" is the default and a submit with no package silently gifts a right with platform defaults (this happened during the test); the ledger list does not show the package; the gift page has no admin header/navigation | Make package required, add package column, use the admin layout |
| F-11 | S2 | Private-seller area has only Overview, My listings, Messages, Account. `/favorites/`, `/messages/`, profile and settings return 404. No saved boats, saved searches or alerts | Add favourites and search alerts; competitors treat these as core |
| F-12 | S3 | Broker listing cards: price and "Estimated payment" text overlap and are clipped ("Estim... pay...") | Fix card layout at 3-column widths |
| F-13 | S3 | "Your message has been sent" is small plain text under the button and its presence is inconsistent; no link to the created conversation | Clear confirmation with "View conversation" |
| F-14 | S3 | Throttle message is raw: "Expected available in 2824 seconds" | Friendly text with minutes |
| F-15 | S2 | The dev site is served over plain HTTP: login and tokens cross the network unencrypted; `crypto.subtle` is unavailable in this context (the app carries a JS fallback for hashing) | HTTPS before any real user |
| F-16 | S3 | Dates use the US format (09/20/2027) in the English UI while the audience is Italy/Spain | Locale-aware date format |
| F-17 | S4 | Public broker list contains "demo-9-pending-harbour-brokers" (name suggests a not-yet-approved broker) - needs a check that pending brokers are not public | Verify status filter |

## 4. User-experience notes (first-time seller)

- The path "List my boat -> create" is clear, but the six-step form is one very long page; the anchor tabs at the top help, the preview card on the right is a good idea.
- After the free allowance is used the page explains it, but "Paid listings are not on sale yet" is a dead end for a real user. It needs a next step (notify me / contact).
- Nothing tells the seller how long a listing stays online or what happens at the end until they read the small print. State "30 days, 1 photo" on the free plan and the package length on paid plans right where they choose.
- The status "In review" gives no expected wait time.

## 5. Comparison with competitors (from general knowledge, not a fresh session)

| Topic | Typical competitor (YachtWorld, Boatshop24, Click&Boat, Apolloduck) | NAUTA now |
| --- | --- | --- |
| Saved boats and alerts | Standard | Missing |
| Listing lifecycle (withdraw, mark sold, renew) | Standard | Partial (renew exists, withdraw not visible) |
| Photo upload | Drag and drop, live thumbnails, reorder | Works, but counters and progress are weak |
| Trust signals | Verified seller badges | Not seen |
| Pricing transparency | Clear tier table | Good on the pricing page, paid listings not yet on sale |

## 6. Not covered in round 1

Search filters and sorting, semantic search, compare, financing calculator, guides, IT/ES translations
and the AI translate buttons, notifications and email delivery, account settings and password reset,
mobile and tablet layouts, keyboard and screen-reader accessibility, browser matrix, load and abuse
testing, staff approval of the four listings (needed to verify 30/60/90 day lengths), buyer-side
messaging replies, broker and professional dashboards, and the Stripe payment steps (Stripe is not configured).

## 7. Next round

1. Staff approves the four listings; verify expiry dates (30 / 60 / 90 / 30 days) and the seven-day and one-day reminder emails.
2. Test expired-listing re-activation and extension with a chosen package.
3. Broker, professional and staff roles: reply to the messages sent in this round.
4. Repeat upload with a non-H.264 video to verify transcoding.

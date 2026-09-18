# Listing view analytics — purpose, data and retention

Required by `NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md` §19.4: "Delete view identity
rows when the listing is permanently deleted; otherwise retain while necessary for
lifetime uniqueness and document the purpose/retention."

This is that document. It describes the `analytics.ListingView` table only.

## Purpose

To show each published boat listing's **unique lifetime view count** to the public
and to its seller (spec §19, §29.1). Counting uniquely requires remembering who has
already been counted; that memory is this table and it has no other use.

It is not used for profiling, targeting, recommendation, cross-listing behavioural
analysis or any form of advertising, and no such use may be added without revisiting
this document and the site privacy policy.

## What is stored

| Column | Content |
|---|---|
| `listing` | Which listing was viewed. |
| `viewer_type` | `USER` or `ANONYMOUS`. |
| `viewer_user` | For signed-in viewers: the account. `NULL` otherwise. |
| `viewer_hash` | For anonymous viewers: `HMAC-SHA256(CONTACT_HASH_SECRET, canonical_client_ip)`. `NULL` otherwise. |
| `first_viewed_at` | When this viewer was first counted on this listing. |
| `last_seen_at` | When this viewer most recently loaded this listing. |
| `user_agent_class` | `HUMAN` / `BOT` / `UNKNOWN`, from the explicit detection policy in `analytics/policies.py`. |

**No raw IP address is stored** (spec §11.7). The hash is keyed on
`CONTACT_HASH_SECRET`; rotating that secret invalidates every existing anonymous
identity, which will cause returning anonymous viewers to be counted once more
each. Raw addresses may appear briefly in ordinary web-server and security access
logs, under the retention stated in the site privacy policy — never here.

**No user agent string, referrer, session id, device fingerprint, screen size,
geolocation or dwell time is stored.** The table is deliberately the minimum that
makes "count each viewer once" true.

## Who can see it

- **Sellers and the public:** the aggregate integer only (`view_count` in the
  public listing payload, from `BoatListing.view_count_cached`). No endpoint in
  this project serializes a `ListingView` row, and none may be added — spec §19.4:
  "Never expose viewer identities to sellers; only aggregate count."
- **Staff:** read-only, staff **administrators** only, via Django admin, with the
  hash masked to its first 12 characters (`analytics/admin.py`). Staff moderators
  do not have access; their work needs the listing, not its audience.
- **Nobody** can write, edit or delete a row through any interface. Rows are
  created by `analytics.recording.record_listing_view()` and removed only by the
  cascades below.

## Retention

- **While the listing exists:** retained. Lifetime uniqueness is the purpose, so a
  row deleted early would let an already-counted viewer be counted again. Spec
  §36.2 makes this explicit: republishing a listing after expiry must not reset its
  count, and neither does a slug change, because identity is by listing **ID**.
- **When the listing is permanently deleted:** its rows are deleted with it
  (`listing` FK, `on_delete=CASCADE`). Spec §19.4, first requirement.
- **When a viewer's account is deleted:** that viewer's rows are deleted with it
  (`viewer_user` FK, `on_delete=CASCADE`), so an erasure request needs no special
  handling. The intended consequence: the next reconciliation run lowers the
  affected listings' counts. A "unique viewers" number whose viewer no longer
  exists should go down.
- **Anonymous rows** have no separate expiry. They are pseudonymous, carry no
  contact data, and deleting them would silently re-inflate counts. Should a
  retention ceiling ever be required, it belongs beside the reconciliation task in
  `analytics/tasks.py` and must be recorded here first.

## Operational limitations (stated, not hidden)

- A household, office or carrier-NAT sharing one address counts as **one**
  anonymous viewer (spec §19.2). UI copy therefore says "views", never "people".
- One person viewing anonymously and then signing in counts **twice**, by design:
  spec §19.2 forbids "risky probabilistic identity merging".
- Bot exclusion is by explicit User-Agent policy, not reverse-DNS verification, so
  a crawler that disguises itself as a browser is counted (spec §36.2: "uncertain
  clients may count and are labeled operational limitation").
- An anonymous viewer on IPv6 is identified by their **full** address unless
  `IPV6_HASH_PREFIX_BITS` is configured (it ships at `0`, off). One subscriber
  holding a `/64` can therefore appear as many distinct anonymous viewers. Set
  `IPV6_HASH_PREFIX_BITS=64` to collapse each prefix into one identity; the trade
  is that everyone behind that prefix then counts once.

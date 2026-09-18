# NAUTA Phase 10 — Unique Listing Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Count each viewer of a published boat listing exactly once for the lifetime of that listing — writing the already-existing, already-serialized `BoatListing.view_count_cached` for the first time — with owner/broker/staff/bot/prefetch views excluded, no raw IP ever stored, and a reconciliation task that can recompute the cached number from the underlying rows.

**Architecture:** A new Django app, `analytics`, owns spec §11.7's `ListingView` table, the eligibility/identity policy and the write path. It depends one-directionally on `listings` (FK to `BoatListing`, read-only use of `ListingStatus`) and never mutates listing workflow state. The only change inside `listings/` is a five-line hook on the public detail view, which spec §30.1 already designates as the "counted-view integration" point. A shared `common.ip` module supplies spec §11.7's `canonical_client_ip` and the single HMAC used to pseudonymize it, replacing an unconfigured, entirely client-controllable `X-Forwarded-For` read that the existing throttle inherited from DRF. The frontend contribution is the localized, accessible view-count formatter and component that spec §19.5 requires; mounting it on a boat card is Phase 20's job because no boat card exists yet.

**Tech Stack:** Python 3.13 + `uv`, Django 5.2 LTS, Django REST Framework, PostgreSQL 16, Redis (cache + throttle counters), Celery (existing `maintenance` queue); **Next.js 16.3.5** (App Router, TypeScript), **Tailwind CSS v4**, `pnpm`, Vitest + Testing Library. No new third-party dependencies in either project.

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) — primarily **§19 (Phase 10)** and **§11.7 (`ListingView`)**, plus §7 (dependency order), §29.1 (boat card required fields), §30.1/§30.2/§30.4 (endpoint inventory, response conventions, rate-limit privacy rule), §34.7 (release checklist line "View counts are unique under the defined identity rule and owner/staff/bot excluded"), §35.1/§35.2 (the `unique_listing_views` flag and its rollout step), §36.2 (operational limitations for views), §37 (localization), §39 (developer execution protocol), §40 Scenario E.

**Predecessor plans (read before starting):**
- [`2026-09-18-phase-11-listing-workflow.md`](./2026-09-18-phase-11-listing-workflow.md) — **hard dependency and binding contract.** Its "Contract summary for later phases" lists everything importable from `listings`; its **rules 1, 2, 3, 9, 10 and 11** are binding here. Its Known Limitation **5** ("No view counting — `BoatListing.view_count_cached` is serialized as-is and nothing in this phase writes to it → Phase 10") is precisely this plan's mandate.
- [`2026-09-18-phase-5-directory-consolidation.md`](./2026-09-18-phase-5-directory-consolidation.md) — structural template: new domain app, audited services, public read endpoints, typed EN/IT/ES message dictionary on the frontend, Vitest component tests.
- [`2026-09-17-phase-3-identity-organizations-permissions.md`](./2026-09-17-phase-3-identity-organizations-permissions.md) — `accounts.services.is_staff_admin/active_broker_membership`, `common.throttling.HashedIPScopedRateThrottle`, `common.exceptions.nauta_exception_handler`, `audit.services.record_audit_event()`.

---

## Global Constraints

Exact values copied from the spec. Every task's requirements implicitly include this section.

- **Real dependency ruling (cite this, do not re-derive it).** Spec §7's dependency table lists Phase 10 as depending on **3, 4** only. That is incomplete: §19's entire subject is `BoatListing`, `ListingView`'s FK target, `view_count_cached` and the published-listing detail endpoint — all of which are defined by **Phase 11**, which the same table lists as depending on 3 and 4 rather than on Phase 10. `docs/superpowers/PHASE-TRACKER.md`'s Phase 10 row records the controller's ruling verbatim: *"Same issue as Phase 9: needs `ListingView`/`BoatListing` from Phase 11 in practice, not just 3,4 per the spec table. **Phase 11 is now done — unblocked, ready to plan.** `BoatListing.view_count_cached` already exists and is serialized as-is by the public read API; this phase is what writes to it."* The real dependency set is therefore **3, 4 and 11**, all three fully merged into `dev`. Do not open this phase against a tree where Phase 11 is absent.
- **Counted event (spec §19.1, verbatim):** "A view is considered only on a successful human GET of a published boat detail page/API detail view. Search-result card impressions do not count." Excluded when: the viewer is the private listing owner; the viewer belongs to the owning broker organization; the viewer is staff; the request is HEAD, prefetch/prerender, health check or known verified bot; the listing is not published.
- **Identity (spec §19.2, verbatim):** authenticated eligible viewer → `viewer_user`; anonymous eligible viewer → HMAC hash of canonical client IP; "If an anonymous viewer later logs in, the authenticated identity may count separately; do not attempt risky probabilistic identity merging"; "A household sharing an IP may count as one anonymous viewer. UI copy says 'views', not 'people'."
- **Hash formula (spec §11.7, verbatim):** `viewer_hash = HMAC-SHA256(CONTACT_HASH_SECRET, canonical_client_ip)`. "Do not store raw IP in `ListingView`. Proxy headers are trusted only from configured reverse proxies."
- **`ListingView` fields (spec §11.7, verbatim list):** `id`, `listing FK`, `viewer_type USER | ANONYMOUS`, `viewer_user nullable FK`, `viewer_hash nullable char(64)`, `first_viewed_at`, `last_seen_at`, `user_agent_class HUMAN | BOT | UNKNOWN`.
- **`ListingView` constraints (spec §11.7, verbatim):** unique `(listing, viewer_user)` where `viewer_user` is not null; unique `(listing, viewer_hash)` where `viewer_hash` is not null; exactly one of viewer user and viewer hash is present.
- **Write path (spec §19.3, verbatim numbering):** 1. resolve viewer identity; 2. `INSERT ... ON CONFLICT DO UPDATE last_seen_at` or equivalent; 3. increment `view_count_cached` **only when a new unique row is inserted**; 4. run in a short transaction, do not delay page rendering if an async durable event pipeline already exists; 5. provide a reconciliation task that recomputes cached counts from rows. "The count must not increment on refresh, repeated API fetch or a second browser using the same anonymous IP."
- **Privacy and retention (spec §19.4):** never expose viewer identities to sellers, only the aggregate count; raw IP may exist briefly in normal security/access logs but **not** in the analytics table; delete view identity rows when the listing is permanently deleted, otherwise retain while necessary for lifetime uniqueness and **document the purpose/retention**; restrict row-level analytics to authorized staff/engineering.
- **UI (spec §19.5):** all published boat cards show eye icon + localized integer, including zero; boat detail and owner dashboards use the same aggregate; "Use compact formatting only above 9,999 and provide exact value in accessible label/title."
- **Feature flag key for this phase:** `unique_listing_views` (spec §35.1's list). Flags gate both frontend exposure and backend mutation; §35.2 step 9 is "Enable finance and view counting". Seeded **disabled** so the code ships ahead of the feature (§35.2 step 4).
- **Spec §36.2 operational limitations** are requirements, not commentary: a slug change must not reset views (identity uses listing ID); republishing after expiry must not reset the lifetime unique count; "CDN/page caching must still call a controlled view-record endpoint or server event; it must not increment from card impressions"; "Known bots are excluded by explicit detection policy; uncertain clients may count and are labeled operational limitation."
- **Spec §29.1 prohibits hard-coded view counts** on boat cards. Every number rendered comes from `view_count`, which comes from `BoatListing.view_count_cached`.
- Backend: Python 3.13 + `uv`, Django 5.2 LTS, DRF for all JSON APIs, PostgreSQL 16 and Redis via the existing `docker-compose.yml` (Postgres `127.0.0.1:5433`, Redis `127.0.0.1:6380`, MinIO `127.0.0.1:9010`).
- Backend dev server port is **8020**; frontend dev server port is **3020**.
- **Tests run against PostgreSQL, never SQLite.** `backend/config/settings/test.py` MUST NOT be modified to override `DATABASES` or `CACHES` to SQLite / `LocMemCache`. This rule was violated and reverted once already in this project — if a test is slow or awkward against real Postgres/Redis, fix the test, never the settings.
- All primary keys are UUIDs; all timestamps are timezone-aware UTC (spec §11 preamble). User references use `settings.AUTH_USER_MODEL` in model fields and `django.contrib.auth.get_user_model()` in code/tests (Phase 3 contract rule 1).
- **Rate limiting uses `common.throttling.HashedIPScopedRateThrottle`** (installed as `DEFAULT_THROTTLE_CLASSES`). Views declare only `throttle_scope`, never `throttle_classes` (Phase 3 contract rule 9). This plan adds **no new throttle scope**: the only endpoint it touches, `GET /api/v1/listings/<id>/`, already carries `throttle_scope = "public_listing_read"` at `300/min` from Phase 11.
- Every error response uses the spec §30.2 envelope, produced automatically by `common.exceptions.nauta_exception_handler`. Times are ISO 8601 UTC.
- **Error codes introduced by this plan: none.** This phase adds no new failure mode to any API response — recording is a side effect of a successful `200`, and when it is not permitted the response is unchanged. If a later fix-forward round needs one, it must be added to this list and to Phase 11's stable-code list (Phase 11 contract rule 10).
- **Every visible state maps to a real backend source** (spec §2.1). No invented counts, no seeded demo views, no placeholder numbers.
- No partial or visual-only implementations, no faked/hardcoded demo data, no TODO placeholders for backend enforcement (spec §39).
- TDD per task: write the failing test, run it and see it fail, write the minimal implementation, run it and see it pass, commit.
- **Where a task says "append to" an existing module, its code block repeats the imports that block needs.** Consolidate them into the module's single import section at the top rather than leaving mid-file `import` statements.
- **Every settings and urls edit in this plan is additive.** `backend/config/settings/base.py` already carries merged entries from Phases 0/1, 2, 3, 4, 5, 8 and 11. Read the real file, add to it, never paste over it.

## Execution Model

Per the standing project convention recorded in `ACTIVITY.md`: each task is implemented on its own branch off the current tip of `dev` (`git checkout -b task-N-<slug> dev`), run through `subagent-driven-development`'s implementer → task-reviewer → fix-loop cycle, opened as a PR (`gh pr create`), and merged by the controller only when CI is green and the branch is cleanly mergeable. Tasks run strictly sequentially — never two branches in flight at once — and each new task branches from the just-merged `dev` tip. This includes Task 1.

---

## Phase boundaries and rulings (decided here — do not re-litigate)

Spec §19 is five short subsections and leaves several mechanical choices open. Each is ruled below so no task has to guess.

**Note (ruling — `ListingView` lives in a new `analytics` app, not in `listings`).**
Spec §3's suggested Django app list names `analytics` explicitly, and `ACTIVITY.md` line 35 records that same decomposition as the project's architecture decision. Three further reasons make it right here: (1) Phase 11's contract rules 1–3 make `listings` a tightly-owned workflow module whose state may only be written through its own services — an analytics writer with a different transaction shape does not belong inside it; (2) the dependency is cleanly one-directional (`analytics` imports `listings`; `listings` imports exactly one function from `analytics`, at the view layer, which is the outermost layer of the app); (3) spec §11.6's `FinanceQuoteLog` and any later engagement metric belong in the same place, so the app is not built for one table. This plan touches `backend/listings/` in exactly **two** files — `views.py` (the §30.1 integration hook) and `tests/` (no change) — and touches `models.py`, `serializers.py`, `drafts.py`, `submissions.py`, `decisions.py`, `payloads.py`, `snapshots.py`, `policies.py`, `locking.py`, `enums.py`, `signals.py` and `urls.py` **zero** times.

**Note (ruling — the counted-view integration point is `GET /api/v1/listings/<id>/`, and no separate beacon endpoint is built).**
Spec §30.1's own table annotates that endpoint "public detail and counted-view integration", so the hook belongs there. Spec §36.2 adds "CDN/page caching must still call a controlled view-record endpoint or server event", which reads as a constraint on *whoever introduces page caching*, not as a mandate for a second write route today: the detail endpoint is an uncached DRF view, there is no CDN in front of it, and there is no boat detail page yet (Phase 20). Building a `POST /api/v1/listings/<id>/views/` beacon now would mean shipping an unauthenticated public write endpoint with no consumer — a strictly larger attack surface for zero delivered behaviour, and a second place for the exclusion rules to drift out of sync. The mechanism is nonetheless kept honest: the whole decision + write is one importable service, `analytics.recording.record_listing_view(listing=..., request=...)`, so the phase that introduces caching mounts it on a route in one line rather than reimplementing it. Recorded in Known Limitations and in the Contract summary.

**Note (ruling — `PublicListingDetailView` must parse credentials again, via an authentication class that cannot 401).**
Phase 11 set `authentication_classes = []` on both public read views, deliberately, so "an expired or malformed Authorization header cannot turn a public page into a 401". That decision is load-bearing and is preserved — but with it in place `request.user` is *always* `AnonymousUser` on the detail endpoint, which makes three of spec §19.1's five exclusions (owner, broker member, staff) unimplementable and would silently count every signed-in owner as an anonymous IP. This phase therefore introduces `common.authentication.OptionalJWTAuthentication`: a `JWTAuthentication` subclass that returns `None` instead of raising on any `AuthenticationFailed`, so a bad header degrades to "anonymous" exactly as an absent header does. It is applied **only** to `PublicListingDetailView`. `PublicListingListView` keeps `authentication_classes = []` untouched, because the list endpoint records nothing and has no use for an identity.

**Note (ruling — recording is synchronous, inside the request, not via Celery).**
Spec §19.3 item 4 says "Run in a short transaction; do not delay page rendering **if an async durable event pipeline already exists**". None exists: `common/tasks.py` contains a single `ping` task and there is no durable event outbox anywhere in the repository. Pushing view events through Celery without an outbox would trade a ~1 ms indexed insert for silent, unbounded data loss on any broker outage — the opposite of what §19.3 item 3's "increment only when a new unique row is inserted" is trying to guarantee. The write is therefore performed in-request: one `INSERT` (or one `UPDATE` on conflict) plus, only on insertion, one `UPDATE ... SET view_count_cached = view_count_cached + 1`. Both touch indexed columns on rows the request has already loaded. If a durable event pipeline is ever built (spec §27/§22 territory), `record_listing_view` is the one function that moves behind it.

**Note (ruling — recording failures are not swallowed).**
A defensive `try/except Exception: pass` around the write would convert a broken analytics path into a permanently-undercounted metric that nobody notices, which spec §39's execution protocol forbids in spirit ("no partial or visual-only implementations"). The `IntegrityError` that the uniqueness race legitimately produces **is** caught, precisely and narrowly, because it is an expected outcome rather than a fault. Everything else propagates and is rendered by the standard §30.2 envelope. This is a deliberate availability/observability trade and is listed in Known Limitations as a candidate for spec §22 (Phase 22, "Security, privacy, performance and observability") to revisit with a real error budget.

**Note (ruling — the `unique_listing_views` flag gates the write, not the read).**
Spec §35.1: "Flags gate both frontend exposure and backend mutation. Do not leave an enabled API behind a disabled UI unintentionally." The mutation here is the `ListingView` insert and the counter increment, so the flag is checked at the top of `record_listing_view()`. It is emphatically **not** checked on the detail endpoint itself: gating a public read behind a rollout flag would 403 the public catalogue, which is Phase 11's shipped, flag-free behaviour. While the flag is off, `view_count` serializes the honest value `0` for every listing and no row is written — exactly the "code ships ahead of the feature" posture §35.2 step 4 asks for, with step 9 flipping it on.

**Note (ruling — "canonical client IP" means the right-most trusted hop, and this phase fixes a real rate-limit-bypass bug on the way).**
Spec §11.7: "Proxy headers are trusted only from configured reverse proxies." No such configuration exists today. The relevant DRF behaviour is not what a summary of "DRF takes the wrong XFF entry" would suggest, so it is quoted here from the installed source (`rest_framework/throttling.py`, DRF 3.18.1) rather than paraphrased:

```python
    def get_ident(self, request):
        xff = request.headers.get('x-forwarded-for')
        remote_addr = request.META.get('REMOTE_ADDR')
        num_proxies = api_settings.NUM_PROXIES

        if num_proxies is not None:
            if num_proxies == 0 or xff is None:
                return remote_addr
            addrs = xff.split(',')
            client_addr = addrs[-min(num_proxies, len(addrs))]
            return client_addr.strip()

        return ''.join(xff.split()) if xff else remote_addr
```

Two things follow, and both are the opposite of the intuitive reading:

1. **When `NUM_PROXIES` *is* configured, DRF already counts from the right** (`addrs[-min(num_proxies, len(addrs))]`) — the same direction `common.ip.canonical_client_ip()` counts. This phase is not reversing DRF's direction; the two agree once configured.
2. **When `NUM_PROXIES` is `None`, DRF uses the ENTIRE `X-Forwarded-For` header as the identity** — `''.join(xff.split())` is the whole header with whitespace stripped out, not its left-most entry. `NUM_PROXIES` is `None` in this project (`grep -rn NUM_PROXIES backend/` returns nothing outside the installed DRF package; it is unset in `config/settings/base.py` and in every settings module). So the throttle bucket today is keyed on a string the caller writes in full. An attacker does not need to guess or spoof one address: sending a *different* arbitrary `X-Forwarded-For` value on every request yields a brand-new, never-before-seen bucket every time. That is a **complete rate-limit bypass**, not a partial spoofing risk — spec §30.4's limits currently bind only clients that choose to send a stable header or none at all.

The same header would become the input to `viewer_hash` if it were reused there, which would mean unbounded view inflation from one machine. Task 1 therefore introduces `common.ip.canonical_client_ip()`, which counts `settings.TRUSTED_PROXY_COUNT` hops from the **right** and falls back to `REMOTE_ADDR`, and repoints the existing throttle at it. The real disagreement with DRF is not about direction: it is that DRF's *unconfigured* default trusts the client completely, whereas `TRUSTED_PROXY_COUNT` defaults to `0` — meaning `X-Forwarded-For` is ignored entirely, which is the correct and safe value for the current deployment, where Django is reached directly. Safe by default, opt in to trust.

**Note (ruling — IPv6 addresses are canonicalized, and truncation to a subnet is built but ships disabled).**
`canonical_client_ip()` normalizes the *representation* unconditionally: it strips ports and brackets, collapses IPv4-mapped IPv6 (`::ffff:198.51.100.9` → `198.51.100.9`) so one host is one identity rather than one per transport, and emits `ipaddress`'s compressed form so `2001:db8:0:0:0:0:0:1` and `2001:db8::1` hash identically.

Truncating an IPv6 address to a prefix is a separate question, and it is **not** merely a privacy preference. A residential or mobile IPv6 allocation is normally a `/64` — 2^64 addresses, all usable outbound by one subscriber — so hashing the full address means one subscriber can mint an unbounded number of distinct `viewer_hash` values, each indistinguishable from a genuine first-time viewer. That is a direct attack on spec §11.7's "practical uniqueness control", and no throttle blunts it, because a fresh source address is also a fresh throttle bucket. Spec §19.2 does not ask for subnet aggregation, but it does not license an inflation vector either.

The ruling is therefore: build the mitigation, ship it off. `settings.IPV6_HASH_PREFIX_BITS` (Task 1) defaults to `0`, which changes nothing, and a deployment sets it to `64` once real traffic justifies the accuracy cost — enabling it merges every viewer behind a prefix into one identity, and the correct prefix length is not knowable before launch. This is the same "safe default, override later" shape as `TRUSTED_PROXY_COUNT`, and it means turning the mitigation on is a config change rather than a code change under pressure. IPv4 is never truncated. Recorded as Known Limitation 13.

**Note (ruling — "viewer is staff" means the STAFF primary role or a superuser, which is broader than `is_staff_moderator()`).**
`accounts.services.is_staff_moderator()` additionally requires membership of the `staff_moderator`/`staff_admin` Django group, because it authorizes an action. Exclusion is the opposite kind of decision: a staff account that has not been put in a group yet is still a staff member browsing the catalogue, and counting them would corrupt a seller's metric. `analytics.policies.viewer_is_staff()` therefore checks `user.is_superuser or user.primary_role == UserRole.STAFF` and does not consult groups. Both helpers keep their own meaning; neither is changed.

**Note (ruling — "belongs to the owning broker organization" means any active membership, regardless of capability flags or organization status).**
`accounts.services.active_broker_membership()` filters on `broker__status=ACTIVE`, which is right for authorization (a suspended org grants nothing) and wrong for exclusion (a suspended org's staff are still insiders). `analytics.policies.viewer_is_listing_insider()` therefore queries `BrokerMembership` directly on `user`, `broker_id` and `is_active=True`, ignoring `can_edit_listings` / `can_read_messages` / `can_manage_team` and organization status — it fails **closed**, excluding more rather than fewer. `is_active=False` (a removed ex-employee) is deliberately *not* excluded: they are a genuine outside viewer, and keeping a departed agent permanently uncountable would be an unbounded, unauditable exclusion list.

**Note (ruling — bot detection is an explicit, versioned substring policy; verified-bot reverse DNS is out of scope).**
Spec §19.1 excludes a "known verified bot" and §36.2 qualifies that as "Known bots are excluded by explicit detection policy; uncertain clients may count and are labeled operational limitation." Reverse-DNS verification (the literal meaning of "verified") requires a DNS round-trip inside the request path and a per-operator forward-confirm allowlist — an operational subsystem the spec provides no configuration for. This phase implements the "explicit detection policy" half: a named, ordered, commented tuple of lowercase User-Agent markers in `analytics/policies.py`, plus the standard prefetch/prerender request headers. Everything not matching a marker and not empty is `HUMAN`; an absent or empty User-Agent is `UNKNOWN` and **counts**, exactly as §36.2 instructs. Recorded in Known Limitations.

**Note (ruling — "health check" needs no separate rule).**
Spec §19.1 lists "health check" among excluded requests. This project's health check is `GET /api/v1/health/` (`common.views.HealthCheckView`) — a different URL, which cannot reach listing detail and therefore cannot record anything. Any *monitoring agent* that does hit a listing URL identifies itself in its User-Agent and is covered by the bot marker list (`uptime`, `pingdom`, `monitor`, `curl`, `wget`, `python-requests`, `go-http-client` and friends are all in it). No third mechanism is built.

**Note (ruling — the detail response includes the viewer's own view).**
Spec §19's acceptance test 1 is "First eligible view increments from 0 to 1", with no statement about what that first response body shows. Serving `0` to the person who just became view number one is confusing and makes the acceptance test awkward to express over HTTP. `PublicListingDetailView.retrieve()` therefore records first and, **only when a row was actually inserted**, re-reads the single column with `listing.refresh_from_db(fields=["view_count_cached"])` before serializing. The re-read (rather than an in-memory `+= 1`) is what makes the number correct when other viewers incremented concurrently.

**Note (ruling — the increment must not bump `version` or `updated_at`).**
`BoatListing.version` is Phase 11's optimistic-locking column (spec §20.5) and `updated_at` is `auto_now`. A view is not an edit: bumping either would hand sellers spurious `409 stale_version` errors while a page was merely being browsed, and would forge an edit timestamp. The increment is therefore `BoatListing.objects.filter(pk=...).update(view_count_cached=F("view_count_cached") + 1)` — `QuerySet.update()` writes exactly the named column and does not fire `auto_now`. This is also why the increment does **not** go through `listings.locking.bump_version` (Phase 11 contract rule 4, which governs state-changing endpoints — this is not one).

**Note (ruling — `viewer_user` cascades on account deletion; lifetime counts may legitimately go down).**
Spec §19.4 requires deleting view identity rows when the listing is permanently deleted (hence `listing` → `CASCADE`) but says nothing about account erasure. The applicable case is the **viewer**, not the seller: a `ListingView.viewer_user` is typically a browsing buyer who owns no listings at all, and nothing else in the project holds their rows, so a `PROTECT` here would make their account undeletable and a `SET_NULL` is forbidden by the "exactly one of viewer user and viewer hash" constraint (a NULL-user row would then need a hash it does not have). `CASCADE` is the only option that leaves the table consistent, and it means a viewer's erasure request needs no per-table special handling.

Note that this reasoning deliberately does **not** rest on sellers: `BoatListing.owner_user` is `on_delete=PROTECT` (Phase 11), so an account that still owns a listing cannot be deleted at all today, and "erasure must always be satisfiable" is therefore not yet a true statement about sellers. Whichever phase makes seller erasure possible has to solve that for `BoatListing` first; this ruling is only about the viewer side.

The consequence is stated rather than hidden: after a viewer's account is erased, reconciliation lowers the affected listings' `view_count_cached`. That is the correct behaviour for a "unique viewers" metric whose viewer no longer exists, and it is documented in the retention note Task 6 writes.

**Note (ruling — spec §19.5's card is a formatter and a component here, not a mounted card).**
"All published boat cards show eye icon + localized integer" presupposes a boat card. None exists: `frontend/src/components/` holds `auth/`, `directory/` and `layout/` only, there is no `/boats` route, and spec §7 assigns "Public card/profile integration and responsive QA" to **Phase 20** (depends on 5–10) with the role-aware listing UI in **Phase 16**. Building a speculative card here would be the invented UI spec §2.1 forbids and would be rewritten by Phase 20 anyway. What this phase *can* deliver completely and test properly is the part §19.5 actually specifies numerically — the localized integer, the "compact only above 9,999" threshold, the exact value in the accessible label/title, and the zero case — so Task 7 ships `formatViewCount`/`formatExactViewCount` and a self-contained `<ViewCount>` component with EN/IT/ES strings and Vitest coverage. Phase 20 imports the component into the card; it does not reimplement the rule. Recorded in Known Limitations and in the Contract summary.

---

## File Structure

```
nautelo/
├── ACTIVITY.md                                              (modify: Task 8)
├── docs/
│   ├── privacy/listing-view-analytics.md                    (new: Task 6 — spec §19.4 "document the purpose/retention")
│   └── superpowers/plans/2026-09-18-phase-10-listing-analytics.md   (this file)
├── backend/
│   ├── .env.example                                         (modify: Task 1 — TRUSTED_PROXY_COUNT, IPV6_HASH_PREFIX_BITS)
│   ├── config/settings/base.py                              (modify: Task 1 — TRUSTED_PROXY_COUNT, IPV6_HASH_PREFIX_BITS; Task 2 — INSTALLED_APPS; Task 6 — CELERY_TASK_ROUTES)
│   ├── common/
│   │   ├── ip.py                                            (new: Task 1 — canonical_client_ip, hash_client_ip)
│   │   ├── throttling.py                                    (modify: Task 1 — delegate to common.ip)
│   │   ├── authentication.py                                (new: Task 5 — OptionalJWTAuthentication)
│   │   └── tests/
│   │       ├── test_ip.py                                   (new: Task 1)
│   │       └── test_authentication.py                       (new: Task 5)
│   ├── listings/
│   │   └── views.py                                         (modify: Task 5 — detail-view hook ONLY)
│   └── analytics/
│       ├── __init__.py, apps.py                             (Task 2)
│       ├── enums.py                                         (Task 2)
│       ├── models.py                                        (Task 2)
│       ├── admin.py                                         (Task 2)
│       ├── policies.py                                      (Task 3)
│       ├── recording.py                                     (Task 4)
│       ├── tasks.py                                         (Task 6)
│       ├── management/commands/reconcile_listing_views.py   (Task 6)
│       ├── migrations/
│       │   ├── 0001_listingview.py                          (generated: Task 2)
│       │   └── 0002_seed_unique_listing_views_flag.py       (hand-written data: Task 4)
│       └── tests/
│           ├── __init__.py, factories.py                    (Task 2)
│           ├── test_listing_view_model.py                   (Task 2)
│           ├── test_policies.py                             (Task 3)
│           ├── conftest.py                                  (Task 4 — the view_counting_enabled flag fixture ONLY; cache isolation is the root backend/conftest.py's job)
│           ├── test_recording.py                            (Task 4)
│           ├── test_detail_view_counting.py                 (Task 5)
│           ├── test_reconciliation.py                       (Task 6)
│           └── test_phase_acceptance.py                     (Task 8)
└── frontend/src/
    ├── lib/
    │   ├── i18n/listings.ts                                 (new: Task 7)
    │   ├── i18n/listings.test.ts                            (new: Task 7)
    │   ├── listings/view-count.ts                           (new: Task 7)
    │   └── listings/view-count.test.ts                      (new: Task 7)
    └── components/listings/
        ├── ViewCount.tsx                                    (new: Task 7)
        └── ViewCount.test.tsx                               (new: Task 7)
```

---


### Task 1: Canonical client IP and the single IP-pseudonymization helper

Spec §11.7 names `canonical_client_ip` as an input to `viewer_hash` but nothing in the repository produces one, and the function DRF supplies in its place uses the entire client-supplied `X-Forwarded-For` header verbatim whenever `NUM_PROXIES` is unset — which it is here — making every current rate limit bypassable by simply varying that header. This task builds the real thing, repoints the existing throttle at it so the project keeps exactly one IP secret and one IP parser, and leaves `TRUSTED_PROXY_COUNT=0` — which ignores `X-Forwarded-For` entirely — as the default.

Before starting, confirm the two facts this task rests on: `grep -rn NUM_PROXIES backend/ --include='*.py' | grep -v '\.venv'` must return **nothing** (the setting is unset, so DRF takes its unconfigured branch), and `backend/.venv/Lib/site-packages/rest_framework/throttling.py`'s `BaseThrottle.get_ident` must end in `return ''.join(xff.split()) if xff else remote_addr` (DRF 3.18.1). If either has changed, re-derive the rationale before writing the tests.

**Files:**
- Create: `backend/common/ip.py`
- Create: `backend/common/tests/test_ip.py`
- Modify: `backend/common/throttling.py` (whole file — 31 lines today)
- Modify: `backend/config/settings/base.py` (two additions beside `CONTACT_HASH_SECRET`, around line 179)
- Modify: `backend/.env.example` (two additions beside `CONTACT_HASH_SECRET`, line 32)

**Interfaces:**
- Consumes: `settings.CONTACT_HASH_SECRET` (Phase 0/1), `rest_framework.throttling.ScopedRateThrottle`.
- Produces:
  - `common.ip.canonical_client_ip(request) -> str | None` — the trusted client address in canonical text form, or `None` when none can be determined.
  - `common.ip.hash_client_ip(value: str) -> str` — 64-char lowercase hex HMAC-SHA256 of `value` under `CONTACT_HASH_SECRET`.
  - `common.ip.XFF_HEADER` — the `"HTTP_X_FORWARDED_FOR"` META key, exported so tests never retype it.
  - `settings.TRUSTED_PROXY_COUNT: int` — number of reverse proxies **we operate** in front of Django. `0` means none.
  - `settings.IPV6_HASH_PREFIX_BITS: int` — optional IPv6 prefix length to collapse into one identity before hashing. `0` (the default) disables truncation; IPv4 is never truncated. See Known Limitation 13.

- [ ] **Step 1: Write the failing test**

Create `backend/common/tests/test_ip.py`:

```python
"""Spec §11.7 ("Proxy headers are trusted only from configured reverse proxies")
and §30.4 ("Rate limiting must not store raw IP beyond approved security systems").

The forged-header tests below are the reason this module exists. DRF's stock
BaseThrottle.get_ident() ends in `return ''.join(xff.split()) if xff else
remote_addr` — so when NUM_PROXIES is unset (it is unset in this project) the
identity is the ENTIRE X-Forwarded-For header, verbatim, as the caller wrote it.
Not its left-most entry: the whole string. A caller who varies that header on
every request gets a fresh identity on every request. canonical_client_ip()
instead derives the identity only from evidence we produced ourselves —
REMOTE_ADDR, or the hop written by a proxy we actually operate.
"""

import pytest
from rest_framework.test import APIRequestFactory

from common.ip import XFF_HEADER, canonical_client_ip, hash_client_ip


@pytest.fixture
def factory():
    return APIRequestFactory()


def _get(factory, *, remote_addr="198.51.100.9", xff=None):
    extra = {"REMOTE_ADDR": remote_addr}
    if xff is not None:
        extra[XFF_HEADER] = xff
    return factory.get("/api/v1/listings/", **extra)


def test_with_no_trusted_proxies_the_forwarded_header_is_ignored_entirely(
    factory, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    request = _get(factory, remote_addr="198.51.100.9", xff="203.0.113.7, 10.0.0.1")

    assert canonical_client_ip(request) == "198.51.100.9"


def test_with_one_trusted_proxy_the_right_most_hop_wins_not_the_spoofable_first(
    factory, settings
):
    # Our own proxy appended "198.51.100.9"; "203.0.113.7" is the attacker's
    # hand-written prefix. DRF's stock get_ident() with NUM_PROXIES unset would
    # return the whole header, "203.0.113.7,198.51.100.9" — an identity the
    # attacker can change at will. (With NUM_PROXIES=1 DRF would agree with us
    # and return "198.51.100.9"; the disagreement is only about the default.)
    settings.TRUSTED_PROXY_COUNT = 1
    request = _get(factory, remote_addr="10.0.0.1", xff="203.0.113.7, 198.51.100.9")

    assert canonical_client_ip(request) == "198.51.100.9"


def test_with_two_trusted_proxies_it_counts_two_hops_from_the_right(factory, settings):
    settings.TRUSTED_PROXY_COUNT = 2
    request = _get(
        factory, remote_addr="10.0.0.1", xff="203.0.113.7, 198.51.100.9, 10.0.0.2"
    )

    assert canonical_client_ip(request) == "198.51.100.9"


def test_a_chain_shorter_than_the_configured_proxy_count_falls_back_to_remote_addr(
    factory, settings
):
    settings.TRUSTED_PROXY_COUNT = 2
    request = _get(factory, remote_addr="10.0.0.1", xff="198.51.100.9")

    assert canonical_client_ip(request) == "10.0.0.1"


def test_a_missing_forwarded_header_falls_back_to_remote_addr(factory, settings):
    settings.TRUSTED_PROXY_COUNT = 1
    request = _get(factory, remote_addr="10.0.0.1")

    assert canonical_client_ip(request) == "10.0.0.1"


def test_whitespace_around_chain_entries_is_tolerated(factory, settings):
    settings.TRUSTED_PROXY_COUNT = 1
    request = _get(factory, remote_addr="10.0.0.1", xff="203.0.113.7,   198.51.100.9  ")

    assert canonical_client_ip(request) == "198.51.100.9"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("198.51.100.9:51234", "198.51.100.9"),
        ("[2001:db8::1]:443", "2001:db8::1"),
        ("2001:0db8:0000:0000:0000:0000:0000:0001", "2001:db8::1"),
        # One host is one identity, not one identity per transport.
        ("::ffff:198.51.100.9", "198.51.100.9"),
    ],
)
def test_addresses_are_canonicalized_to_one_form_per_host(
    factory, settings, raw, expected
):
    settings.TRUSTED_PROXY_COUNT = 0
    request = _get(factory, remote_addr=raw)

    assert canonical_client_ip(request) == expected


@pytest.mark.parametrize("raw", ["", "   ", "not-an-ip", "999.1.1.1", "[2001:db8::1"])
def test_an_unparseable_address_yields_none_rather_than_a_bogus_identity(
    factory, settings, raw
):
    settings.TRUSTED_PROXY_COUNT = 0
    request = _get(factory, remote_addr=raw)

    assert canonical_client_ip(request) is None


def test_ipv6_is_not_truncated_by_default(factory, settings):
    """Safe default: the setting changes nothing until a deployment sets it."""
    settings.TRUSTED_PROXY_COUNT = 0
    settings.IPV6_HASH_PREFIX_BITS = 0
    request = _get(factory, remote_addr="2001:db8::dead:beef")

    assert canonical_client_ip(request) == "2001:db8::dead:beef"


@pytest.mark.parametrize(
    "raw", ["2001:db8:0:1::1", "2001:db8:0:1:aaaa:bbbb:cccc:dddd", "2001:db8:0:1::"]
)
def test_when_enabled_every_address_in_one_ipv6_prefix_is_one_identity(
    factory, settings, raw
):
    """The counter-inflation mitigation: 2**64 addresses, one viewer identity.

    Without this, one residential /64 allocation can mint 2**64 distinct
    viewer_hash values that each look like a legitimate first-time viewer.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    settings.IPV6_HASH_PREFIX_BITS = 64

    assert canonical_client_ip(_get(factory, remote_addr=raw)) == "2001:db8:0:1::"


def test_ipv4_is_never_truncated_even_when_the_setting_is_on(factory, settings):
    """An IPv4 address is already one host; masking it would merge strangers."""
    settings.TRUSTED_PROXY_COUNT = 0
    settings.IPV6_HASH_PREFIX_BITS = 64
    request = _get(factory, remote_addr="198.51.100.9")

    assert canonical_client_ip(request) == "198.51.100.9"


def test_the_hash_is_a_stable_64_character_hex_digest_that_hides_the_address():
    digest = hash_client_ip("198.51.100.9")

    assert len(digest) == 64
    assert set(digest) <= set("0123456789abcdef")
    assert "198.51.100.9" not in digest
    assert digest == hash_client_ip("198.51.100.9")
    assert digest != hash_client_ip("198.51.100.10")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest common/tests/test_ip.py -v`

Expected: FAIL — collection error, `ModuleNotFoundError: No module named 'common.ip'`.

- [ ] **Step 3: Write the implementation**

Create `backend/common/ip.py`:

```python
"""Canonical client IP resolution and pseudonymization (spec §11.7, §19.2, §30.4).

Spec §11.7: "`viewer_hash = HMAC-SHA256(CONTACT_HASH_SECRET, canonical_client_ip)`.
Do not store raw IP in `ListingView`. Proxy headers are trusted only from
configured reverse proxies."

`X-Forwarded-For` is appended to by each hop, and the first hop may be the client
itself: a request arriving with `X-Forwarded-For: 203.0.113.7` when no proxy is
deployed is simply a header someone typed. The only entry that cannot be forged is
the one written by the outermost proxy *we operate*, so this module counts
`settings.TRUSTED_PROXY_COUNT` hops from the RIGHT-hand end of the chain.

Counting from the right is also what DRF's `BaseThrottle.get_ident()` does *once
`NUM_PROXIES` is configured* (`addrs[-min(num_proxies, len(addrs))]`). The problem
this module exists to fix is DRF's behaviour when `NUM_PROXIES` is NOT configured,
which is this project's state: its final line is

    return ''.join(xff.split()) if xff else remote_addr

— the identity becomes the ENTIRE client-supplied header, verbatim. That is not
merely "the wrong entry"; there is no entry selection at all. A caller who sends a
different arbitrary `X-Forwarded-For` value on each request lands in a different
throttle bucket on each request, which is a complete bypass of every rate limit in
spec §30.4 rather than a way to impersonate one other address. This module has no
unconfigured-and-trusting mode: absent configuration it trusts nothing but the
socket.

`TRUSTED_PROXY_COUNT` defaults to 0, which ignores the header completely and uses
`REMOTE_ADDR`. That is the correct value for the current deployment, where Django
is reached directly; raise it to the number of proxies actually in front of it.

`IPV6_HASH_PREFIX_BITS` defaults to 0 (off). See `_truncate_ipv6` below: it exists
because a single residential IPv6 /64 allocation is 2**64 addresses, every one of
which would otherwise hash to a distinct `viewer_hash` and look like a distinct
unique viewer. It is off by default because turning it on merges more households
into one identity, and that trade should be made against observed traffic rather
than guessed at now. Known Limitation 13 records the gap.
"""

import hashlib
import hmac
import ipaddress

from django.conf import settings

XFF_HEADER = "HTTP_X_FORWARDED_FOR"


def _normalize(candidate: str) -> str | None:
    """One canonical text form per host, or None if this is not an address."""
    value = (candidate or "").strip()
    if not value:
        return None

    if value.startswith("["):
        # "[2001:db8::1]:443" -> "2001:db8::1"
        closing = value.find("]")
        if closing == -1:
            return None
        value = value[1:closing]
    elif value.count(":") == 1:
        # "198.51.100.9:51234" -> "198.51.100.9". A bare IPv6 address always has
        # more than one colon, so this only ever strips an IPv4 port.
        value = value.split(":", 1)[0]

    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return None

    # "::ffff:198.51.100.9" and "198.51.100.9" are the same host. Collapsing them
    # keeps one identity per viewer rather than one per transport.
    mapped = getattr(address, "ipv4_mapped", None)
    if mapped is not None:
        address = mapped
    return str(_truncate_ipv6(address))


def _truncate_ipv6(address):
    """Optionally reduce an IPv6 address to its network prefix. Off by default.

    Spec §11.7 calls `viewer_hash` "a practical uniqueness control, not a perfect
    identity claim". A /64 is the standard allocation handed to one residential
    or mobile subscriber, and every one of its 2**64 addresses is usable for
    outbound traffic — so an unmodified full-address hash lets one subscriber
    mint an unbounded number of "unique viewers", and no throttle catches it
    either (a fresh source address is also a fresh throttle bucket). Truncation
    is the standard mitigation.

    It is nonetheless OFF by default (`IPV6_HASH_PREFIX_BITS = 0`), for the same
    reason `TRUSTED_PROXY_COUNT` is 0: the safe-by-default value is the one that
    changes nothing until a deployment knowingly configures it. Enabling it
    merges every viewer sharing a prefix into one identity, which is a real
    accuracy cost, and the right prefix length depends on traffic nobody has
    seen yet. Set it to 64 once that traffic exists. IPv4 is never truncated —
    an IPv4 address is already one host, and masking it would merge unrelated
    subscribers.
    """
    bits = int(getattr(settings, "IPV6_HASH_PREFIX_BITS", 0) or 0)
    if bits <= 0 or bits >= 128 or address.version != 6:
        return address
    return ipaddress.ip_network(f"{address}/{bits}", strict=False).network_address


def canonical_client_ip(request) -> str | None:
    """The trusted client address for `request`, or None when none can be trusted."""
    trusted = int(getattr(settings, "TRUSTED_PROXY_COUNT", 0) or 0)
    remote_addr = _normalize(request.META.get("REMOTE_ADDR", ""))
    if trusted <= 0:
        return remote_addr

    chain = [
        part
        for part in (request.META.get(XFF_HEADER, "") or "").split(",")
        if part.strip()
    ]
    if len(chain) < trusted:
        # Fewer hops than we operate: this header did not come through our own
        # proxy chain, so none of it is evidence. Fall back to the socket.
        return remote_addr
    return _normalize(chain[-trusted])


def hash_client_ip(value: str) -> str:
    """Spec §11.7's HMAC — the single place this project derives an IP pseudonym.

    One function, one secret: rotating CONTACT_HASH_SECRET rotates every derived
    identifier (throttle buckets and `ListingView.viewer_hash`) at once.
    """
    return hmac.new(
        settings.CONTACT_HASH_SECRET.encode(), str(value).encode(), hashlib.sha256
    ).hexdigest()
```

- [ ] **Step 4: Add the setting and document the environment variable**

In `backend/config/settings/base.py`, directly **below** the existing `CONTACT_HASH_SECRET` line (around line 179), add:

```python
# Spec §11.7 / §30.4: "Proxy headers are trusted only from configured reverse
# proxies." The number of reverse proxies WE operate in front of Django. 0 means
# none, so `X-Forwarded-For` is ignored entirely and `REMOTE_ADDR` is the client
# — correct for the current deployment, where Django is reached directly. Set it
# to 1 behind a single nginx/CDN edge, 2 behind two, and so on. Read by
# common.ip.canonical_client_ip(); never infer it from request contents.
TRUSTED_PROXY_COUNT = env.int("TRUSTED_PROXY_COUNT", default=0)

# Optional IPv6 prefix truncation before an address becomes an identity. 0 = off,
# which is the shipped default and changes nothing. A single residential IPv6 /64
# is 2**64 usable addresses, so an untruncated hash lets one subscriber generate
# an unbounded number of apparently-unique viewers (and an unbounded number of
# throttle buckets). Setting this to 64 collapses each /64 into one identity, at
# the cost of merging everyone behind that prefix. Off by default because the
# right value depends on real traffic; see Known Limitation 13 in the Phase 10
# plan. IPv4 is never truncated. Read by common.ip.canonical_client_ip().
IPV6_HASH_PREFIX_BITS = env.int("IPV6_HASH_PREFIX_BITS", default=0)
```

In `backend/.env.example`, directly below the existing `CONTACT_HASH_SECRET=change-me-in-dev` line (line 32), add:

```bash
# Number of reverse proxies in front of Django (spec 11.7). 0 = none; the
# X-Forwarded-For header is then ignored. Only raise this to a number of proxies
# you actually operate - every hop you claim is a hop a client can forge.
TRUSTED_PROXY_COUNT=0

# Optional: collapse each IPv6 /N prefix into one viewer/throttle identity.
# 0 = off (default). 64 is the usual value if view-count inflation from IPv6
# address rotation is ever observed. IPv4 is never truncated.
IPV6_HASH_PREFIX_BITS=0
```

No CI change is needed: `env.int(..., default=0)` means an unset variable is valid for both, so `.github/workflows/ci.yml` keeps working unmodified.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && uv run pytest common/tests/test_ip.py -v`
Expected: PASS — 21 tests (the three parametrized cases expand to 4, 5 and 3).

- [ ] **Step 6: Write the failing throttle tests**

Append to `backend/common/tests/test_throttling.py`, keeping the existing test unchanged and consolidating the imports into the file's single import section at the top:

```python
from rest_framework.test import APIRequestFactory

from common.ip import XFF_HEADER, hash_client_ip
from common.throttling import HashedIPScopedRateThrottle


def test_the_throttle_bucket_is_derived_from_the_canonical_ip(settings):
    """One IP parser, one secret: the throttle and `viewer_hash` must agree."""
    settings.TRUSTED_PROXY_COUNT = 0
    request = APIRequestFactory().post(
        "/api/v1/auth/register/", REMOTE_ADDR="198.51.100.9"
    )

    assert HashedIPScopedRateThrottle().get_ident(request) == hash_client_ip(
        "198.51.100.9"
    )


def test_a_forged_forwarded_header_cannot_move_a_caller_to_a_fresh_bucket(settings):
    """Spec §30.4's limits are worthless if a header resets the counter.

    With no trusted proxies configured, two requests from one socket must land in
    one bucket no matter what X-Forwarded-For claims.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    factory = APIRequestFactory()
    throttle = HashedIPScopedRateThrottle()

    honest = factory.post("/api/v1/auth/register/", REMOTE_ADDR="198.51.100.9")
    forged = factory.post(
        "/api/v1/auth/register/",
        REMOTE_ADDR="198.51.100.9",
        **{XFF_HEADER: "203.0.113.7"},
    )

    assert throttle.get_ident(forged) == throttle.get_ident(honest)


def test_rotating_the_forwarded_header_cannot_mint_endless_fresh_buckets(settings):
    """The actual pre-fix defect, stated precisely.

    DRF's unconfigured `get_ident()` returns `''.join(xff.split())` — the WHOLE
    header. So the bypass is not "impersonate one other address", it is "send a
    different header each time and never reuse a bucket". Three requests from one
    socket with three different headers must produce one identity, not three.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    factory = APIRequestFactory()
    throttle = HashedIPScopedRateThrottle()

    idents = {
        throttle.get_ident(
            factory.post(
                "/api/v1/auth/register/",
                REMOTE_ADDR="198.51.100.9",
                **{XFF_HEADER: chain},
            )
        )
        for chain in ("203.0.113.7", "203.0.113.8, 10.0.0.1", "1.1.1.1, 2.2.2.2")
    }

    assert len(idents) == 1


def test_an_unresolvable_address_never_falls_back_to_drfs_header_trusting_logic(
    settings,
):
    """The fallback must not re-open the hole this class exists to close.

    When `canonical_client_ip()` cannot parse an address (no REMOTE_ADDR at all
    under some ASGI/unix-socket/proxy-protocol setups), delegating to
    `super().get_ident()` would hand identity back to the raw X-Forwarded-For
    header — the exact behaviour being replaced, reachable by simply omitting
    REMOTE_ADDR. The fallback is `REMOTE_ADDR` read directly, so an absent
    address yields an empty, header-independent ident instead.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    throttle = HashedIPScopedRateThrottle()
    request = APIRequestFactory().post("/api/v1/auth/register/")
    request.META.pop("REMOTE_ADDR", None)
    request.META[XFF_HEADER] = "203.0.113.7"

    assert throttle.get_ident(request) == ""

    request.META[XFF_HEADER] = "198.51.100.9, 10.0.0.1"
    assert throttle.get_ident(request) == ""
```

- [ ] **Step 7: Run them to verify the forged-header tests fail**

Run: `cd backend && uv run pytest common/tests/test_throttling.py -v`

Expected: `test_a_forged_forwarded_header_cannot_move_a_caller_to_a_fresh_bucket`, `test_rotating_the_forwarded_header_cannot_mint_endless_fresh_buckets` and `test_an_unresolvable_address_never_falls_back_to_drfs_header_trusting_logic` all FAIL.

Be precise about *why* the first one fails, because the obvious explanation is wrong. With `NUM_PROXIES` unset, DRF's inherited `get_ident()` does not select an entry at all — its last line is `return ''.join(xff.split()) if xff else remote_addr`, so it returns the whole header with whitespace removed. For `forged` that is the string `"203.0.113.7"`, which happens to look like a single address only because this test sends a single-entry chain; for `honest` there is no header, so it returns `REMOTE_ADDR`, `"198.51.100.9"`. The two idents therefore differ and the assertion fails — but the mechanism is "the entire client-supplied header became the identity", not "the left-most entry was selected". The second test makes that unambiguous by sending multi-entry chains that no address-selection reading could explain.

`test_the_throttle_bucket_is_derived_from_the_canonical_ip` passes already (no header is present in it); that is expected — it is the regression pin, not the bug demonstration.

- [ ] **Step 8: Repoint the throttle at `common.ip`**

Replace the entire contents of `backend/common/throttling.py` with:

```python
from rest_framework.throttling import ScopedRateThrottle

from common.ip import canonical_client_ip, hash_client_ip


class HashedIPScopedRateThrottle(ScopedRateThrottle):
    """ScopedRateThrottle that never lets a raw client IP reach the cache.

    DRF's SimpleRateThrottle.get_cache_key() embeds get_ident()'s return value
    verbatim, producing Redis keys like `throttle_auth_192.0.2.7`. Spec §30.4 is
    explicit: "Rate limiting must not store raw IP beyond approved security
    systems." Hashing the identifier keeps the throttle exactly as effective
    (the hash is stable and 1:1 with the address) while storing no readable one.

    Two things changed in Phase 10 and both matter:

    1. The address now comes from `common.ip.canonical_client_ip()`, which counts
       `settings.TRUSTED_PROXY_COUNT` hops from the RIGHT of `X-Forwarded-For`
       and, at the default of 0, ignores that header entirely.

       What this replaced is worse than "DRF picks the wrong entry". DRF's
       inherited `get_ident()` ends in
       `return ''.join(xff.split()) if xff else remote_addr`, so with
       `NUM_PROXIES` unset — and it is unset in this project — the identity IS
       the entire client-supplied header. No entry is selected. A caller who
       varied `X-Forwarded-For` on every request got a brand-new throttle bucket
       on every request: not bucket-sharing or impersonation, but an unlimited
       supply of buckets, i.e. no rate limit at all. (Note that once
       `NUM_PROXIES` IS set DRF counts from the right just as we do — the defect
       is entirely in its unconfigured default, which trusts the client.)
    2. The HMAC lives in `common.ip.hash_client_ip()` rather than inline, so the
       throttle and spec §11.7's `ListingView.viewer_hash` derive identities with
       one implementation and one secret (CONTACT_HASH_SECRET). Rotating that
       secret rotates both at once.

    There is deliberately NO `super().get_ident()` fallback. `super()` is the
    header-trusting method above; falling back to it when
    `canonical_client_ip()` returns None would re-open the whole vulnerability
    behind a condition an attacker can often arrange (an absent or unparseable
    REMOTE_ADDR happens under some ASGI/daphne, unix-socket and proxy-protocol
    setups). The fallback is `REMOTE_ADDR` read directly, which is the same
    evidence `canonical_client_ip()` uses and never consults a client header. If
    even that is absent the ident is empty — a single shared bucket for such
    requests, which is coarse but fails CLOSED rather than open.
    """

    def get_ident(self, request):
        ident = canonical_client_ip(request) or request.META.get("REMOTE_ADDR", "")
        if not ident:
            return ident
        return hash_client_ip(ident)
```

- [ ] **Step 9: Run the whole `common` suite**

Run: `cd backend && uv run pytest common/tests/ -v`
Expected: PASS — the original `test_the_cache_key_never_contains_the_raw_ip` still passes unchanged, plus the four new throttle tests and the 21 IP tests.

- [ ] **Step 10: Run the full backend suite for regressions**

Run: `cd backend && uv run pytest -q`
Expected: PASS. `HashedIPScopedRateThrottle` is the project-wide default throttle class, so this is the blast-radius check and it is not optional.

- [ ] **Step 11: Commit**

```bash
git add backend/common/ip.py backend/common/tests/test_ip.py backend/common/throttling.py backend/common/tests/test_throttling.py backend/config/settings/base.py backend/.env.example
git commit -m "feat(common): canonical client IP resolution and shared IP hashing"
```

---

### Task 2: The `analytics` app, spec §11.7's `ListingView` model and its restricted admin

Everything spec §11.7 lists, with every constraint it names enforced in the database rather than in Python, plus the §19.4 access restriction: row-level view analytics are visible to staff administrators only, and to nobody at all through the API.

**Files:**
- Create: `backend/analytics/__init__.py` (empty)
- Create: `backend/analytics/apps.py`
- Create: `backend/analytics/enums.py`
- Create: `backend/analytics/models.py`
- Create: `backend/analytics/admin.py`
- Create: `backend/analytics/migrations/__init__.py` (empty)
- Create: `backend/analytics/migrations/0001_listingview.py` (generated by `makemigrations`)
- Create: `backend/analytics/tests/__init__.py` (empty)
- Create: `backend/analytics/tests/factories.py`
- Create: `backend/analytics/tests/test_listing_view_model.py`
- Modify: `backend/config/settings/base.py` (add `"analytics"` to `INSTALLED_APPS`, after `"listings"`)

**Interfaces:**
- Consumes: `common.models.UUIDModel`, `listings.models.BoatListing`, `settings.AUTH_USER_MODEL`, `accounts.services.is_staff_admin` (Phase 3).
- Produces:
  - `analytics.enums.ViewerType` — `TextChoices` with members `USER = "USER"`, `ANONYMOUS = "ANONYMOUS"`.
  - `analytics.enums.UserAgentClass` — `TextChoices` with members `HUMAN = "HUMAN"`, `BOT = "BOT"`, `UNKNOWN = "UNKNOWN"`.
  - `analytics.models.ListingView` — fields `id`, `listing`, `viewer_type`, `viewer_user`, `viewer_hash`, `first_viewed_at`, `last_seen_at`, `user_agent_class`. Reverse accessor on `BoatListing` is `listing.views`.
  - `analytics.tests.factories.make_user_view(listing, *, user, **kwargs) -> ListingView`
  - `analytics.tests.factories.make_anonymous_view(listing, *, viewer_hash=None, **kwargs) -> ListingView`
  - `analytics.tests.factories.fake_hash(seed: str) -> str` — a deterministic 64-char lowercase hex string for tests that need a well-formed hash without an IP.

**Note (ruling — `ListingView` inherits `UUIDModel`, not `UUIDTimeStampedModel`).** Spec §11.7's field list names `first_viewed_at` and `last_seen_at` and no others. Adding `created_at`/`updated_at` alongside them would give the row four timestamps, two of which mean exactly what the other two mean — the same reasoning `common.models.TimeStampedModel`'s own docstring gives, and the same choice `audit.AuditEvent` and `listings.ListingSnapshot` already made.

**Note (ruling — BOTH timestamps are plain `DateTimeField`s written explicitly from one captured `now`; `first_viewed_at` must NOT use `auto_now_add`).** This is the single most load-bearing mechanical detail in the model, so it is ruled rather than left to taste. `auto_now_add=True` generates its value at the moment the `INSERT` statement is executed, which is strictly *after* any `now = timezone.now()` the caller captured beforehand. Every insert path in this plan captures `now` first and passes it as `last_seen_at` — so with `auto_now_add` the row would be written with `last_seen_at < first_viewed_at` and the `analytics_view_last_seen_not_before_first_viewed` CHECK constraint would reject **every single first insert**, deterministically. That failure would not even be loud: `_insert_or_touch` (Task 4) catches `IntegrityError` as the expected uniqueness race, so it would fall through to an `UPDATE` matching zero rows and return `counted=False` with no row written and no error raised — precisely the silent-undercount outcome the "recording failures are not swallowed" ruling forbids. Therefore: `first_viewed_at` and `last_seen_at` are both plain `DateTimeField()`s, and **every** code path that creates a `ListingView` (Task 2's factories, Task 4's `_insert_or_touch`, and any inline `ListingView.objects.create(...)` in a test) passes the **same** captured `now` value to both. `last_seen_at` additionally could not be `auto_now` anyway, because the conflict path updates it through `QuerySet.update()`, which never fires `auto_now`.

- [ ] **Step 1: Scaffold the app and register it**

Create `backend/analytics/__init__.py` (empty), `backend/analytics/migrations/__init__.py` (empty) and `backend/analytics/tests/__init__.py` (empty).

Create `backend/analytics/apps.py`:

```python
from django.apps import AppConfig


class AnalyticsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "analytics"
```

In `backend/config/settings/base.py`, add `"analytics",` to `INSTALLED_APPS` immediately after the existing `"listings",` entry. Read the real list and insert one line; do not retype the block.

- [ ] **Step 2: Write the failing model test**

Create `backend/analytics/tests/factories.py`:

```python
import hashlib

from django.utils import timezone

from analytics.enums import UserAgentClass, ViewerType
from analytics.models import ListingView


def fake_hash(seed: str) -> str:
    """A well-formed 64-char lowercase hex digest for tests that need a hash
    without going through an IP. Real hashes come from common.ip.hash_client_ip."""
    return hashlib.sha256(seed.encode()).hexdigest()


# Both timestamps are written explicitly, from ONE captured `now`. Neither field
# auto-generates: `first_viewed_at` is a plain DateTimeField precisely so that a
# value generated at INSERT time cannot end up later than the `last_seen_at` the
# caller captured a moment earlier, which would violate the
# `analytics_view_last_seen_not_before_first_viewed` CHECK on every first row.
def make_user_view(listing, *, user, **kwargs):
    now = timezone.now()
    defaults = {
        "listing": listing,
        "viewer_type": ViewerType.USER,
        "viewer_user": user,
        "viewer_hash": None,
        "first_viewed_at": now,
        "last_seen_at": now,
        "user_agent_class": UserAgentClass.HUMAN,
    }
    defaults.update(kwargs)
    return ListingView.objects.create(**defaults)


def make_anonymous_view(listing, *, viewer_hash=None, **kwargs):
    now = timezone.now()
    defaults = {
        "listing": listing,
        "viewer_type": ViewerType.ANONYMOUS,
        "viewer_user": None,
        "viewer_hash": viewer_hash or fake_hash(f"anon-{listing.pk}"),
        "first_viewed_at": now,
        "last_seen_at": now,
        "user_agent_class": UserAgentClass.HUMAN,
    }
    defaults.update(kwargs)
    return ListingView.objects.create(**defaults)
```

Create `backend/analytics/tests/test_listing_view_model.py`:

```python
"""Spec §11.7's ListingView, field by field and constraint by constraint.

Every constraint below is a database constraint, not a Python check: the write
path in analytics.recording relies on the unique indexes to serialise concurrent
identical requests (spec §19's acceptance test 5), so a rule enforced only in
application code would be a rule that does not hold under the exact conditions it
exists for.
"""

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from analytics.enums import UserAgentClass, ViewerType
from analytics.models import ListingView
from analytics.tests.factories import fake_hash, make_anonymous_view, make_user_view
from listings.tests.factories import make_private_listing

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner():
    return make_user("owner@example.com", role=UserRole.PRIVATE_SELLER, verified=True)


@pytest.fixture
def listing(owner):
    return make_private_listing(owner=owner)


def _viewer(email):
    return make_user(email, role=UserRole.BUYER, verified=True)


def test_an_authenticated_view_stores_the_user_and_no_hash(listing):
    view = make_user_view(listing, user=_viewer("buyer@example.com"))

    assert view.viewer_type == ViewerType.USER
    assert view.viewer_user is not None
    assert view.viewer_hash is None
    assert view.user_agent_class == UserAgentClass.HUMAN
    assert view.first_viewed_at is not None
    assert view.last_seen_at is not None
    assert listing.views.count() == 1


def test_an_anonymous_view_stores_a_hash_and_no_user(listing):
    view = make_anonymous_view(listing)

    assert view.viewer_type == ViewerType.ANONYMOUS
    assert view.viewer_user is None
    assert len(view.viewer_hash) == 64


def test_one_user_cannot_be_recorded_twice_on_one_listing(listing):
    viewer = _viewer("buyer@example.com")
    make_user_view(listing, user=viewer)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_user_view(listing, user=viewer)


def test_one_hash_cannot_be_recorded_twice_on_one_listing(listing):
    digest = fake_hash("one-household")
    make_anonymous_view(listing, viewer_hash=digest)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_anonymous_view(listing, viewer_hash=digest)


def test_the_same_viewer_may_be_recorded_on_a_different_listing(owner, listing):
    viewer = _viewer("buyer@example.com")
    other = make_private_listing(owner=owner)
    digest = fake_hash("one-household")

    make_user_view(listing, user=viewer)
    make_user_view(other, user=viewer)
    make_anonymous_view(listing, viewer_hash=digest)
    make_anonymous_view(other, viewer_hash=digest)

    assert ListingView.objects.count() == 4


def test_a_row_with_neither_a_user_nor_a_hash_is_rejected(listing):
    now = timezone.now()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ListingView.objects.create(
                listing=listing,
                viewer_type=ViewerType.ANONYMOUS,
                viewer_user=None,
                viewer_hash=None,
                first_viewed_at=now,
                last_seen_at=now,
            )


def test_a_row_with_both_a_user_and_a_hash_is_rejected(listing):
    now = timezone.now()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ListingView.objects.create(
                listing=listing,
                viewer_type=ViewerType.USER,
                viewer_user=_viewer("buyer@example.com"),
                viewer_hash=fake_hash("both"),
                first_viewed_at=now,
                last_seen_at=now,
            )


def test_the_viewer_type_must_agree_with_which_identity_column_is_set(listing):
    """A USER row pointing at no user would make every aggregate a guess."""
    now = timezone.now()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ListingView.objects.create(
                listing=listing,
                viewer_type=ViewerType.USER,
                viewer_user=None,
                viewer_hash=fake_hash("mislabelled"),
                first_viewed_at=now,
                last_seen_at=now,
            )


@pytest.mark.parametrize(
    "bad_hash",
    [
        "not-hex-" + "0" * 56,
        "A" * 64,  # uppercase: a second spelling of one identity
        "0" * 63,
        "0" * 65,
    ],
)
def test_a_malformed_hash_is_rejected(listing, bad_hash):
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_anonymous_view(listing, viewer_hash=bad_hash)


def test_the_very_first_insert_satisfies_the_timestamp_constraint(listing):
    """Regression pin for the `auto_now_add` trap.

    If `first_viewed_at` were `auto_now_add=True`, it would be stamped at INSERT
    time — after the `now` the caller already passed as `last_seen_at` — and this
    row, the simplest possible one, would be rejected by
    `analytics_view_last_seen_not_before_first_viewed`. Both columns are written
    explicitly from one captured value, so they are equal on a fresh row.
    """
    view = make_anonymous_view(listing)
    view.refresh_from_db()

    assert view.first_viewed_at == view.last_seen_at


def test_last_seen_at_may_not_predate_first_viewed_at(listing):
    view = make_anonymous_view(listing)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ListingView.objects.filter(pk=view.pk).update(
                last_seen_at=view.first_viewed_at - timezone.timedelta(seconds=1)
            )


def test_deleting_the_listing_deletes_its_view_identity_rows(listing):
    """Spec §19.4: "Delete view identity rows when the listing is permanently
    deleted"."""
    make_user_view(listing, user=_viewer("buyer@example.com"))
    make_anonymous_view(listing)
    assert ListingView.objects.count() == 2

    listing.revisions.all().delete()
    listing.delete()

    assert ListingView.objects.count() == 0


def test_deleting_the_viewing_account_deletes_its_rows(listing):
    """An erasure request must not leave an orphan row. See the plan's ruling:
    the consequence is that reconciliation lowers the lifetime count."""
    viewer = _viewer("buyer@example.com")
    make_user_view(listing, user=viewer)

    viewer.delete()

    assert ListingView.objects.count() == 0
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd backend && uv run pytest analytics/tests/test_listing_view_model.py -v`
Expected: FAIL — collection error, `ModuleNotFoundError: No module named 'analytics.enums'`.

- [ ] **Step 4: Write the enums**

Create `backend/analytics/enums.py`:

```python
from django.db import models


class ViewerType(models.TextChoices):
    """Spec §11.7: `viewer_type USER | ANONYMOUS`."""

    USER = "USER", "Authenticated user"
    ANONYMOUS = "ANONYMOUS", "Anonymous"


class UserAgentClass(models.TextChoices):
    """Spec §11.7: `user_agent_class HUMAN | BOT | UNKNOWN`.

    UNKNOWN is a real, populated value, not a fallback nobody writes: spec §36.2
    says "uncertain clients may count and are labeled operational limitation", so
    a request with no User-Agent at all is recorded as UNKNOWN and counted. BOT
    rows are never written by the request path (a bot is refused before any
    identity is resolved); the member exists so that a future verified-bot
    pipeline, or a staff correction, has the vocabulary the spec names.
    """

    HUMAN = "HUMAN", "Human"
    BOT = "BOT", "Bot"
    UNKNOWN = "UNKNOWN", "Unknown"
```

- [ ] **Step 5: Write the model**

Create `backend/analytics/models.py`:

```python
"""Listing view analytics (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §11.7, §19).

PRIVACY (spec §19.4). This table is pseudonymous by construction and is the one
place in the project where a viewer's presence on a specific listing is durable:

  * No raw IP is stored, ever. `viewer_hash` is
    HMAC-SHA256(CONTACT_HASH_SECRET, canonical_client_ip) and is not reversible
    without the secret. Spec §11.7: "Do not store raw IP in `ListingView`."
  * No row from this table is ever serialized to any API response. Sellers see
    `BoatListing.view_count_cached` and nothing else — spec §19.4: "Never expose
    viewer identities to sellers; only aggregate count."
  * Row-level access is staff-administrator-only, through Django admin, read-only
    (see admin.py).
  * Rows are deleted with their listing (`listing` CASCADE) and with their viewer
    (`viewer_user` CASCADE). Otherwise they are retained for as long as the
    listing exists, because lifetime uniqueness is the whole point of the table
    — spec §19.4: "retain while necessary for lifetime uniqueness and document
    the purpose/retention". The written record of that purpose is
    `docs/privacy/listing-view-analytics.md`.

Spec §11.7 closes with the honest caveat this model is built under: "This is a
practical uniqueness control, not a perfect identity claim."
"""

from django.conf import settings
from django.db import models
from django.db.models import F, Q

from common.models import UUIDModel

from .enums import UserAgentClass, ViewerType

VIEWER_HASH_LENGTH = 64


class ListingView(UUIDModel):
    """One (listing, viewer) pair, created once and touched thereafter.

    Inherits UUIDModel rather than UUIDTimeStampedModel deliberately: spec §11.7
    names `first_viewed_at` and `last_seen_at`, and a `created_at`/`updated_at`
    pair beside them would be two more columns meaning the same two things (the
    same reasoning as audit.AuditEvent and listings.ListingSnapshot).
    """

    listing = models.ForeignKey(
        "listings.BoatListing", on_delete=models.CASCADE, related_name="views"
    )
    viewer_type = models.CharField(max_length=9, choices=ViewerType.choices)
    viewer_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="listing_views",
    )
    viewer_hash = models.CharField(
        max_length=VIEWER_HASH_LENGTH, null=True, blank=True, db_index=False
    )
    # NOT auto_now_add. auto_now_add stamps the row at the moment the INSERT
    # executes, which is strictly AFTER the `now` every caller captures before
    # building the row — so `last_seen_at` (that captured `now`) would be earlier
    # than `first_viewed_at` and the CHECK below would reject every first insert.
    # Both timestamps are therefore written explicitly, from one captured value.
    first_viewed_at = models.DateTimeField()
    # Written explicitly, never auto_now: the conflict path in
    # analytics.recording touches this column with QuerySet.update(), which does
    # not fire auto_now, and an auto_now field would additionally be rewritten by
    # any unrelated save().
    last_seen_at = models.DateTimeField()
    user_agent_class = models.CharField(
        max_length=7, choices=UserAgentClass.choices, default=UserAgentClass.UNKNOWN
    )

    class Meta:
        ordering = ["listing", "-last_seen_at"]
        indexes = [
            # The reconciliation task (spec §19.3 step 5) groups by listing.
            models.Index(fields=["listing", "first_viewed_at"]),
        ]
        constraints = [
            # Spec §11.7: "Unique `(listing, viewer_user)` where `viewer_user` is
            # not null." A partial index, because NULLs do not collide in
            # Postgres and an unconditional unique index would therefore permit
            # unlimited anonymous rows to share (listing, NULL).
            models.UniqueConstraint(
                fields=["listing", "viewer_user"],
                condition=Q(viewer_user__isnull=False),
                name="analytics_view_unique_user_per_listing",
            ),
            # Spec §11.7: "Unique `(listing, viewer_hash)` where `viewer_hash` is
            # not null."
            models.UniqueConstraint(
                fields=["listing", "viewer_hash"],
                condition=Q(viewer_hash__isnull=False),
                name="analytics_view_unique_hash_per_listing",
            ),
            # Spec §11.7: "Exactly one of viewer user and viewer hash is present."
            models.CheckConstraint(
                condition=(
                    Q(viewer_user__isnull=False, viewer_hash__isnull=True)
                    | Q(viewer_user__isnull=True, viewer_hash__isnull=False)
                ),
                name="analytics_view_exactly_one_identity",
            ),
            # viewer_type is a label for which identity column is populated. If
            # the two can disagree, every aggregate grouped by viewer_type is a
            # guess, so the database refuses the disagreement.
            models.CheckConstraint(
                condition=(
                    Q(viewer_type=ViewerType.USER, viewer_user__isnull=False)
                    | Q(viewer_type=ViewerType.ANONYMOUS, viewer_user__isnull=True)
                ),
                name="analytics_view_type_matches_identity",
            ),
            # One spelling per hash. Without this, "AB..." and "ab..." are two
            # rows for one viewer and the unique index above never fires.
            models.CheckConstraint(
                condition=Q(viewer_hash__isnull=True)
                | Q(viewer_hash__regex=r"^[0-9a-f]{64}$"),
                name="analytics_view_hash_is_lowercase_sha256_hex",
            ),
            models.CheckConstraint(
                condition=Q(last_seen_at__gte=F("first_viewed_at")),
                name="analytics_view_last_seen_not_before_first_viewed",
            ),
        ]

    def __str__(self):
        # Deliberately does not print viewer_hash in full: __str__ output reaches
        # logs, admin breadcrumbs and error pages.
        identity = (
            f"user:{self.viewer_user_id}"
            if self.viewer_user_id
            else f"anon:{(self.viewer_hash or '')[:12]}…"
        )
        return f"{self.listing_id} {identity}"
```

- [ ] **Step 6: Generate the migration**

Run: `cd backend && uv run python manage.py makemigrations analytics --name listingview`

Expected: creates `backend/analytics/migrations/0001_listingview.py` with one `CreateModel` plus the index and six constraints. Open the generated file and confirm:

- all six `constraints` are present;
- `dependencies` includes `("listings", "0004_seed_listing_revisions_flag")` (or whatever the current `listings` leaf is) and the `AUTH_USER_MODEL` swappable dependency;
- **`first_viewed_at` is `models.DateTimeField()` with no `auto_now_add=True`**, exactly like `last_seen_at`. If `auto_now_add` appears in the generated file, the model was written wrong — go back and fix `models.py`, then delete and regenerate the migration. Do not hand-edit it. (A generated `auto_now_add` here would make every first insert violate `analytics_view_last_seen_not_before_first_viewed`; see the ruling above.)

Do not hand-edit the generated file for any reason.

Then confirm the app state is clean:

Run: `cd backend && uv run python manage.py makemigrations --check --dry-run`
Expected: exit 0, "No changes detected".

- [ ] **Step 7: Run the model test to verify it passes**

Run: `cd backend && uv run pytest analytics/tests/test_listing_view_model.py -v`
Expected: PASS — 16 tests (13 test functions; the `bad_hash` parametrization expands to 4).

- [ ] **Step 8: Write the failing admin test**

Append to `backend/analytics/tests/test_listing_view_model.py`:

```python
from django.contrib.admin.sites import site as admin_site

from accounts.enums import StaffGroup
from analytics.admin import ListingViewAdmin


def _staff(email, group_name):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    user.groups.add(Group.objects.get(name=group_name))
    return user


def _request_for(user):
    request = RequestFactory().get("/admin/analytics/listingview/")
    request.user = user
    return request


def test_the_admin_is_registered_and_completely_read_only():
    """Spec §19.4: row-level analytics are for authorized staff/engineering, and
    nothing about a view is a thing a human should be able to author."""
    model_admin = admin_site._registry[ListingView]

    assert isinstance(model_admin, ListingViewAdmin)
    assert model_admin.has_add_permission(_request_for(None)) is False
    assert model_admin.has_change_permission(_request_for(None)) is False
    assert model_admin.has_delete_permission(_request_for(None)) is False


@pytest.mark.parametrize(
    ("group", "expected"),
    [(StaffGroup.ADMIN, True), (StaffGroup.MODERATOR, False)],
)
def test_only_staff_administrators_may_read_the_rows(group, expected):
    model_admin = admin_site._registry[ListingView]
    user = _staff(f"{group}@example.com", group)

    assert model_admin.has_view_permission(_request_for(user)) is expected
    assert model_admin.has_module_permission(_request_for(user)) is expected


def test_a_signed_in_non_staff_user_may_not_read_the_rows():
    model_admin = admin_site._registry[ListingView]
    request = _request_for(make_user("buyer2@example.com", role=UserRole.BUYER))

    assert model_admin.has_view_permission(request) is False


def test_the_admin_never_renders_a_full_viewer_hash(listing):
    """A full hash is a stable cross-listing identifier. Staff need to tell rows
    apart, not to correlate one viewer across the whole catalogue."""
    model_admin = admin_site._registry[ListingView]
    view = make_anonymous_view(listing, viewer_hash=fake_hash("masking"))

    rendered = model_admin.masked_viewer_hash(view)

    assert view.viewer_hash not in rendered
    assert rendered.startswith(view.viewer_hash[:12])
    assert "viewer_hash" not in model_admin.list_display
```

Add to that file's import section at the top: `from django.contrib.auth.models import Group` and `from django.test import RequestFactory`.

- [ ] **Step 9: Run it to verify it fails**

Run: `cd backend && uv run pytest analytics/tests/test_listing_view_model.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'analytics.admin'`.

- [ ] **Step 10: Write the admin**

Create `backend/analytics/admin.py`:

```python
"""Spec §19.4: "Restrict access to row-level analytics to authorized
staff/engineering; sellers receive aggregate values only."

Django admin is the only row-level surface this project exposes, so the
restriction is implemented here and nowhere else — there is no analytics API,
no serializer and no staff endpoint that returns a ListingView.
"""

from django.contrib import admin

from accounts.services import is_staff_admin

from .models import ListingView


@admin.register(ListingView)
class ListingViewAdmin(admin.ModelAdmin):
    """Read-only, staff-administrator-only, and never shows a full hash.

    Why staff *admin* rather than staff moderator: a moderator's job (spec §5) is
    approving listings, which needs the listing's content, not the identities of
    the people who looked at it. Spec §19.4 says "authorized staff/engineering",
    and the narrower of the two existing tiers is the one that matches.
    """

    list_display = (
        "id",
        "listing",
        "viewer_type",
        "masked_viewer_hash",
        "user_agent_class",
        "first_viewed_at",
        "last_seen_at",
    )
    list_filter = ("viewer_type", "user_agent_class")
    search_fields = ("listing__id",)
    raw_id_fields = ("listing", "viewer_user")
    readonly_fields = (
        "id",
        "listing",
        "viewer_type",
        "viewer_user",
        "masked_viewer_hash",
        "first_viewed_at",
        "last_seen_at",
        "user_agent_class",
    )
    # `viewer_hash` is deliberately absent from both `fields` and `list_display`:
    # the masked accessor below is the only way it is ever rendered.
    fields = readonly_fields

    @admin.display(description="Viewer hash")
    def masked_viewer_hash(self, obj):
        if not obj.viewer_hash:
            return "—"
        return f"{obj.viewer_hash[:12]}… (masked)"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        return is_staff_admin(getattr(request, "user", None))

    def has_module_permission(self, request):
        return is_staff_admin(getattr(request, "user", None))
```

- [ ] **Step 11: Run the analytics suite to verify it passes**

Run: `cd backend && uv run pytest analytics/ -v`
Expected: PASS — the 16 model tests plus 5 admin tests (the group parametrization expands to 2).

- [ ] **Step 12: Run the full backend suite**

Run: `cd backend && uv run pytest -q`
Expected: PASS. A new app in `INSTALLED_APPS` changes migration state for every test database, so this is not optional.

- [ ] **Step 13: Commit**

```bash
git add backend/analytics backend/config/settings/base.py
git commit -m "feat(analytics): ListingView model, constraints and restricted admin"
```

---

### Task 3: Eligibility and identity policy — spec §19.1's exclusions and §19.2's identity rule

Everything §19 decides *before* a row is written, in one module of pure, exhaustively-tested functions. Nothing here touches the database except to ask whether a viewer holds a broker membership.

**Files:**
- Create: `backend/analytics/policies.py`
- Create: `backend/analytics/tests/test_policies.py`

**Interfaces:**
- Consumes: `common.ip.canonical_client_ip`, `common.ip.hash_client_ip` (Task 1); `analytics.enums.UserAgentClass`, `analytics.enums.ViewerType` (Task 2); `accounts.enums.UserRole`; `brokers.models.BrokerMembership`; `listings.enums.ListingStatus`.
- Produces:
  - `analytics.policies.BOT_USER_AGENT_MARKERS: tuple[str, ...]` — lowercase substrings; the explicit detection policy spec §36.2 demands.
  - `analytics.policies.PREFETCH_META_KEYS: tuple[tuple[str, tuple[str, ...]], ...]` — `(META key, tuple of lowercase values that mean "prefetch")`.
  - `analytics.policies.classify_user_agent(user_agent: str | None) -> str` — a `UserAgentClass` value.
  - `analytics.policies.is_prefetch_request(request) -> bool`
  - `analytics.policies.viewer_is_staff(user) -> bool`
  - `analytics.policies.viewer_is_listing_insider(user, listing) -> bool`
  - `analytics.policies.ViewerIdentity` — frozen dataclass with fields `viewer_type: str`, `viewer_user` (a user instance or `None`), `viewer_hash: str | None`, `user_agent_class: str`, and one method `lookup() -> dict` returning `{"viewer_user": ...}` or `{"viewer_hash": ...}`.
  - `analytics.policies.resolve_viewer_identity(*, request, listing) -> ViewerIdentity | None` — `None` means "this request does not count", for any of spec §19.1's reasons.

- [ ] **Step 1: Write the failing test**

Create `backend/analytics/tests/test_policies.py`:

```python
"""Spec §19.1 (which events count) and §19.2 (who the viewer is).

Every `assert ... is None` below is one line of spec §19.1's exclusion list. They
are the substance of this phase: a counter that increments is easy, and a counter
that refuses to increment for the owner, their colleagues, staff, bots and
prefetches is the thing spec §34.7's release checklist actually gates on.
"""

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIRequestFactory

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from analytics.enums import UserAgentClass, ViewerType
from analytics.policies import (
    classify_user_agent,
    is_prefetch_request,
    resolve_viewer_identity,
    viewer_is_listing_insider,
    viewer_is_staff,
)
from brokers.tests.factories import make_broker, make_membership
from common.ip import hash_client_ip
from listings.enums import ListingStatus
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)

CHROME = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
)


@pytest.fixture
def factory():
    return APIRequestFactory()


def _request(factory, *, method="get", user=None, user_agent=CHROME, remote_addr="198.51.100.9", **extra):
    headers = {"REMOTE_ADDR": remote_addr}
    if user_agent is not None:
        headers["HTTP_USER_AGENT"] = user_agent
    headers.update(extra)
    request = getattr(factory, method)("/api/v1/listings/x/", **headers)
    request.user = user if user is not None else AnonymousUser()
    return request


# --- user agent classification (spec §19.1 "known verified bot", §36.2) -------


@pytest.mark.parametrize(
    "user_agent",
    [
        CHROME,
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
    ],
)
def test_ordinary_browsers_are_human(user_agent):
    assert classify_user_agent(user_agent) == UserAgentClass.HUMAN


@pytest.mark.parametrize(
    "user_agent",
    [
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
        "facebookexternalhit/1.1",
        "Twitterbot/1.0",
        "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
        "curl/8.7.1",
        "python-requests/2.32.3",
        "Go-http-client/2.0",
        "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/141.0.0.0",
        "Pingdom.com_bot_version_1.4",
        "check_http/v2.3 (monitoring-plugins 2.3)",
    ],
)
def test_known_automation_is_a_bot(user_agent):
    assert classify_user_agent(user_agent) == UserAgentClass.BOT


@pytest.mark.parametrize("user_agent", [None, "", "   "])
def test_an_absent_user_agent_is_unknown_not_bot(user_agent):
    """Spec §36.2: "uncertain clients may count and are labeled operational
    limitation"."""
    assert classify_user_agent(user_agent) == UserAgentClass.UNKNOWN


def test_classification_ignores_case():
    assert classify_user_agent("SOMETHING-GOOGLEBOT/2.1") == UserAgentClass.BOT


# --- prefetch / prerender (spec §19.1) ---------------------------------------


@pytest.mark.parametrize(
    "header",
    [
        {"HTTP_SEC_PURPOSE": "prefetch;prerender"},
        {"HTTP_PURPOSE": "prefetch"},
        {"HTTP_X_PURPOSE": "preview"},
        {"HTTP_X_MOZ": "prefetch"},
        {"HTTP_SEC_FETCH_MODE": "no-cors", "HTTP_SEC_PURPOSE": "Prefetch"},
    ],
)
def test_a_prefetch_or_prerender_request_is_detected(factory, header):
    assert is_prefetch_request(_request(factory, **header)) is True


def test_an_ordinary_navigation_is_not_a_prefetch(factory):
    assert is_prefetch_request(_request(factory)) is False


# --- who is an insider (spec §19.1) ------------------------------------------


@pytest.mark.django_db
def test_a_staff_account_is_staff_even_without_a_group():
    assert viewer_is_staff(make_user("s@example.com", role=UserRole.STAFF)) is True


@pytest.mark.django_db
def test_a_staff_moderator_is_staff():
    user = make_user("mod@example.com", role=UserRole.STAFF)
    user.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))

    assert viewer_is_staff(user) is True


@pytest.mark.django_db
def test_a_buyer_is_not_staff():
    assert viewer_is_staff(make_user("b@example.com", role=UserRole.BUYER)) is False


@pytest.mark.django_db
def test_an_anonymous_user_is_not_staff():
    assert viewer_is_staff(AnonymousUser()) is False


@pytest.mark.django_db
def test_the_private_owner_is_an_insider_on_their_own_listing():
    owner = make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(owner=owner)

    assert viewer_is_listing_insider(owner, listing) is True


@pytest.mark.django_db
def test_another_private_seller_is_not_an_insider():
    owner = make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)
    stranger = make_user("other@example.com", role=UserRole.PRIVATE_SELLER)

    assert viewer_is_listing_insider(stranger, make_private_listing(owner=owner)) is False


@pytest.mark.django_db
def test_any_active_member_of_the_owning_broker_is_an_insider_whatever_their_flags():
    """Capability flags authorize actions; they do not decide who is an insider.
    An agent with no permissions at all is still looking at their own shop."""
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker, can_edit_listings=False, can_read_messages=False)
    listing = make_broker_listing(broker=broker, actor=agent)

    assert viewer_is_listing_insider(agent, listing) is True


@pytest.mark.django_db
def test_a_member_of_a_different_broker_is_not_an_insider():
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    other_broker = make_broker("Rival Yachts", "rival-yachts")
    owning_broker = make_broker()
    make_membership(agent, other_broker, can_edit_listings=True)
    listing = make_broker_listing(broker=owning_broker, actor=agent)

    assert viewer_is_listing_insider(agent, listing) is False


@pytest.mark.django_db
def test_a_deactivated_membership_is_not_an_insider():
    """A removed ex-employee is a genuine outside viewer; keeping them
    permanently uncountable would be an unbounded exclusion list."""
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker, can_edit_listings=True, is_active=False)
    listing = make_broker_listing(broker=broker, actor=agent)

    assert viewer_is_listing_insider(agent, listing) is False


# --- the whole decision (spec §19.1 + §19.2) ---------------------------------


def _publish(listing, approver):
    """Phase 11 contract rule 1: "publicly visible" is status PUBLISHED *and* a
    non-null current_public_snapshot. A test that sets only the status would be
    testing a state the public queryset never serves."""
    snapshot = make_snapshot(listing, approved_by=approver)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])
    return listing


@pytest.fixture
def published(db):
    owner = make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)
    return _publish(make_private_listing(owner=owner), owner)


def _resolve(factory, listing, **kwargs):
    return resolve_viewer_identity(request=_request(factory, **kwargs), listing=listing)


@pytest.mark.django_db
def test_an_anonymous_browser_gets_a_hashed_ip_identity(factory, published, settings):
    settings.TRUSTED_PROXY_COUNT = 0
    identity = _resolve(factory, published, remote_addr="198.51.100.9")

    assert identity is not None
    assert identity.viewer_type == ViewerType.ANONYMOUS
    assert identity.viewer_user is None
    assert identity.viewer_hash == hash_client_ip("198.51.100.9")
    assert identity.user_agent_class == UserAgentClass.HUMAN
    assert identity.lookup() == {"viewer_hash": hash_client_ip("198.51.100.9")}


@pytest.mark.django_db
def test_a_signed_in_buyer_gets_a_user_identity_and_no_hash(factory, published):
    buyer = make_user("buyer@example.com", role=UserRole.BUYER)
    identity = _resolve(factory, published, user=buyer)

    assert identity.viewer_type == ViewerType.USER
    assert identity.viewer_user == buyer
    assert identity.viewer_hash is None
    assert identity.lookup() == {"viewer_user": buyer}


@pytest.mark.django_db
def test_the_owner_does_not_count(factory, published):
    assert _resolve(factory, published, user=published.owner_user) is None


@pytest.mark.django_db
def test_a_broker_colleague_does_not_count(factory):
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker)
    listing = _publish(make_broker_listing(broker=broker, actor=agent), agent)

    assert resolve_viewer_identity(
        request=_request(APIRequestFactory(), user=agent), listing=listing
    ) is None


@pytest.mark.django_db
def test_staff_does_not_count(factory, published):
    staff = make_user("staff@example.com", role=UserRole.STAFF)

    assert _resolve(factory, published, user=staff) is None


@pytest.mark.django_db
def test_a_bot_does_not_count(factory, published):
    assert _resolve(factory, published, user_agent="Googlebot/2.1") is None


@pytest.mark.django_db
def test_a_prefetch_does_not_count(factory, published):
    assert _resolve(factory, published, HTTP_SEC_PURPOSE="prefetch") is None


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["head", "post", "put", "patch", "delete"])
def test_only_a_get_counts(factory, published, method):
    assert _resolve(factory, published, method=method) is None


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status",
    [
        ListingStatus.DRAFT,
        ListingStatus.PENDING_APPROVAL,
        ListingStatus.SUSPENDED,
        ListingStatus.EXPIRED,
    ],
)
def test_an_unpublished_listing_does_not_count(factory, published, status):
    published.status = status
    published.save(update_fields=["status", "updated_at"])

    assert _resolve(factory, published) is None


@pytest.mark.django_db
def test_an_anonymous_viewer_with_no_resolvable_address_does_not_count(
    factory, published, settings
):
    """No identity means no uniqueness control, and a row with a NULL hash is
    forbidden by the model anyway. Refusing is the only honest answer."""
    settings.TRUSTED_PROXY_COUNT = 0

    assert _resolve(factory, published, remote_addr="not-an-ip") is None


@pytest.mark.django_db
def test_an_unknown_user_agent_still_counts_and_is_labelled(factory, published):
    """Spec §36.2: uncertain clients may count and are labeled."""
    identity = _resolve(factory, published, user_agent=None)

    assert identity is not None
    assert identity.user_agent_class == UserAgentClass.UNKNOWN
```

Add `from django.contrib.auth.models import AnonymousUser` to the file's import section.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && uv run pytest analytics/tests/test_policies.py -v`
Expected: FAIL — collection error, `ModuleNotFoundError: No module named 'analytics.policies'`.

- [ ] **Step 3: Write the policy module**

Create `backend/analytics/policies.py`:

```python
"""Who counts, and as whom (spec §19.1, §19.2, §36.2).

Everything §19 decides before a row exists lives here, as functions with no side
effects beyond one membership lookup. `analytics.recording` performs the write and
asks no questions of its own; this module answers the questions and writes nothing.
"""

from dataclasses import dataclass

from accounts.enums import UserRole
from common.ip import canonical_client_ip, hash_client_ip
from listings.enums import ListingStatus

from .enums import UserAgentClass, ViewerType

# Spec §36.2: "Known bots are excluded by explicit detection policy; uncertain
# clients may count and are labeled operational limitation." This tuple IS that
# explicit policy — lowercase substrings, matched against a lowercased
# User-Agent. It is deliberately a literal, reviewable list rather than a regex
# or a third-party database: adding an entry is a code review, and every entry
# can be explained.
#
# Grouped by why they are here. Keep the groups; append, do not reorder.
BOT_USER_AGENT_MARKERS = (
    # Generic self-identification. The overwhelming majority of well-behaved
    # crawlers put one of these in their UA.
    "bot",
    "crawler",
    "spider",
    "scraper",
    # Search and social fetchers that do not contain "bot".
    "slurp",  # Yahoo
    "duckduckgo",
    "baiduspider",
    "yandex",
    "facebookexternalhit",
    "embedly",
    "quora link preview",
    "whatsapp",
    "telegrambot",
    "discordbot",
    "slackbot",
    "linkedinbot",
    "pinterest",
    "applebot",
    # Headless browsers and automation drivers.
    "headlesschrome",
    "phantomjs",
    "puppeteer",
    "playwright",
    "selenium",
    # Scripted HTTP clients. A human browser never sends one of these.
    "curl",
    "wget",
    "libwww-perl",
    "python-requests",
    "python-urllib",
    "httpie",
    "go-http-client",
    "java/",
    "okhttp",
    "axios",
    "node-fetch",
    "guzzle",
    # Uptime and monitoring agents. Spec §19.1 excludes "health check"; this
    # project's own health endpoint is a different URL (common.views
    # .HealthCheckView at /api/v1/health/) and cannot reach a listing, so this
    # group covers the only way a monitor reaches one: by being pointed at it.
    "pingdom",
    "uptimerobot",
    "statuscake",
    "site24x7",
    "newrelicpinger",
    "datadog",
    "check_http",
    "monitoring",
    "nagios",
)

# Spec §19.1 excludes "prefetch/prerender". `Sec-Purpose` is the current standard
# (Chrome/Edge speculation rules); the rest are the legacy spellings still sent by
# Safari, Firefox and older Chromium. A match on ANY of them is a refusal, because
# a false negative silently inflates a seller's metric while a false positive only
# declines to count one page view.
PREFETCH_META_KEYS = (
    ("HTTP_SEC_PURPOSE", ("prefetch", "prerender")),
    ("HTTP_PURPOSE", ("prefetch", "preview", "prerender")),
    ("HTTP_X_PURPOSE", ("prefetch", "preview", "prerender")),
    ("HTTP_X_MOZ", ("prefetch", "prerender")),
)


def classify_user_agent(user_agent: str | None) -> str:
    """Spec §11.7's `user_agent_class`. UNKNOWN counts; BOT does not."""
    normalized = (user_agent or "").strip().lower()
    if not normalized:
        return UserAgentClass.UNKNOWN
    if any(marker in normalized for marker in BOT_USER_AGENT_MARKERS):
        return UserAgentClass.BOT
    return UserAgentClass.HUMAN


def is_prefetch_request(request) -> bool:
    for meta_key, markers in PREFETCH_META_KEYS:
        value = (request.META.get(meta_key) or "").strip().lower()
        if value and any(marker in value for marker in markers):
            return True
    return False


def _usable(user) -> bool:
    return bool(
        user is not None
        and getattr(user, "is_authenticated", False)
        and getattr(user, "is_active", False)
    )


def viewer_is_staff(user) -> bool:
    """Spec §19.1: "Viewer is staff."

    Broader than accounts.services.is_staff_moderator(), on purpose: that helper
    also requires a Django group because it authorizes an action. Exclusion is the
    opposite kind of decision — a staff account with no group yet is still staff
    browsing the catalogue, and counting them would corrupt a seller's number.
    """
    if not _usable(user):
        return False
    return bool(
        getattr(user, "is_superuser", False)
        or getattr(user, "primary_role", None) == UserRole.STAFF
    )


def viewer_is_listing_insider(user, listing) -> bool:
    """Spec §19.1: the private listing owner, or a member of the owning broker.

    Not accounts.services.active_broker_membership(): that filters on
    `broker__status=ACTIVE`, which is right for authorization (a suspended org
    grants nothing) and wrong here (a suspended org's staff are still insiders).
    Capability flags are ignored for the same reason — they decide what a member
    may do, not whether they are on the inside. `is_active=False` is deliberately
    NOT excluded: a removed ex-employee is a genuine outside viewer.
    """
    # Function-local import: brokers.admin imports accounts.services, and keeping
    # every brokers import inside the function body matches the pattern
    # accounts.services already uses to stay clear of app-loading cycles.
    from brokers.models import BrokerMembership

    if not _usable(user):
        return False

    if listing.owner_user_id is not None and str(listing.owner_user_id) == str(user.pk):
        return True

    if listing.broker_id is None:
        return False

    return BrokerMembership.objects.filter(
        user=user, broker_id=listing.broker_id, is_active=True
    ).exists()


@dataclass(frozen=True)
class ViewerIdentity:
    """Spec §19.2's resolved identity. Exactly one of the two columns is set."""

    viewer_type: str
    viewer_user: object | None
    viewer_hash: str | None
    user_agent_class: str

    def lookup(self) -> dict:
        """The filter that finds this identity's existing row, if any."""
        if self.viewer_user is not None:
            return {"viewer_user": self.viewer_user}
        return {"viewer_hash": self.viewer_hash}


def resolve_viewer_identity(*, request, listing) -> ViewerIdentity | None:
    """Spec §19.3 step 1. `None` means "this request does not count".

    The order below is the order of spec §19.1's own list, cheapest checks first,
    so the membership query at the end runs only for requests that could count.
    """
    # "a successful human GET". DRF routes HEAD to the same handler as GET while
    # leaving request.method as "HEAD", so this is also §19.1's HEAD exclusion.
    if request.method != "GET":
        return None

    if is_prefetch_request(request):
        return None

    user_agent_class = classify_user_agent(request.META.get("HTTP_USER_AGENT"))
    if user_agent_class == UserAgentClass.BOT:
        return None

    # "Listing is not published." The caller already filtered on
    # listings.views.published_listings_queryset(); this is the same rule
    # restated so the service is safe to call from anywhere (spec §36.2's
    # "controlled view-record endpoint" is the second such caller, if it is ever
    # built). Phase 11 contract rule 1 forbids re-deriving public visibility
    # loosely, and this is deliberately the identical pair of conditions.
    if (
        listing.status != ListingStatus.PUBLISHED
        or listing.current_public_snapshot_id is None
    ):
        return None

    user = getattr(request, "user", None)
    if _usable(user):
        if viewer_is_staff(user) or viewer_is_listing_insider(user, listing):
            return None
        # Spec §19.2: "If an anonymous viewer later logs in, the authenticated
        # identity may count separately; do not attempt risky probabilistic
        # identity merging." So: no lookup of this request's IP hash here, and no
        # attempt to retire the anonymous row. Two rows, by design.
        return ViewerIdentity(
            viewer_type=ViewerType.USER,
            viewer_user=user,
            viewer_hash=None,
            user_agent_class=user_agent_class,
        )

    client_ip = canonical_client_ip(request)
    if client_ip is None:
        # No address means no uniqueness control at all — every such request
        # would be a fresh "viewer". Refusing is the only honest answer, and the
        # model's "exactly one identity" constraint forbids the row anyway.
        return None

    return ViewerIdentity(
        viewer_type=ViewerType.ANONYMOUS,
        viewer_user=None,
        viewer_hash=hash_client_ip(client_ip),
        user_agent_class=user_agent_class,
    )
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && uv run pytest analytics/tests/test_policies.py -v`

Expected: PASS — **51** tests after parametrization expands: 18 user-agent classification (3 + 11 + 3 + 1), 6 prefetch (5 + 1), 4 staff, 5 insider, and 18 `resolve_viewer_identity` (7 plain + 5 `only_a_get` + 4 `unpublished` + 2 plain).

- [ ] **Step 5: Run the analytics suite**

Run: `cd backend && uv run pytest analytics/ -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/analytics/policies.py backend/analytics/tests/test_policies.py
git commit -m "feat(analytics): spec 19.1 view eligibility and 19.2 identity resolution"
```

---

### Task 4: The write path — insert-or-touch, increment only on insert, behind the `unique_listing_views` flag

Spec §19.3 steps 1–3, in one short transaction, plus the §35.1 rollout flag and its seed migration.

**Files:**
- Create: `backend/analytics/recording.py`
- Create: `backend/analytics/migrations/0002_seed_unique_listing_views_flag.py`
- Create: `backend/analytics/tests/conftest.py`
- Create: `backend/analytics/tests/test_recording.py`

**Interfaces:**
- Consumes: `analytics.policies.ViewerIdentity`, `analytics.policies.resolve_viewer_identity` (Task 3); `analytics.models.ListingView` (Task 2); `listings.models.BoatListing`; `platform_settings.services.is_feature_enabled` (Phase 2).
- Produces:
  - `analytics.recording.UNIQUE_LISTING_VIEWS_FLAG = "unique_listing_views"`
  - `analytics.recording.ViewRecordResult` — frozen dataclass with `counted: bool` and `identity: ViewerIdentity | None`.
  - `analytics.recording.record_listing_view(*, listing, request) -> ViewRecordResult` — the single entry point for every caller, present and future.

**Note (ruling — `create` + narrow `IntegrityError` rather than a literal `ON CONFLICT`).** Spec §19.3 step 2 asks for "`INSERT ... ON CONFLICT DO UPDATE last_seen_at` **or equivalent**". Django's only supported way to emit a literal `ON CONFLICT DO UPDATE` is `bulk_create(update_conflicts=True, ...)`, which does not report which rows were inserted versus updated — and step 3 ("increment only when a new unique row is inserted") depends on exactly that distinction. The equivalent used here is a `create()` inside a savepoint, with the `IntegrityError` the unique index raises caught narrowly and converted into the `UPDATE last_seen_at`. It is the same two outcomes with the same guarantee under concurrency (the unique index is what serialises the race, in both designs), it is what `get_or_create()` does internally, and it yields the insert/update signal step 3 needs. The savepoint (`with transaction.atomic()`) matters: without it, the `IntegrityError` would poison any surrounding transaction and the follow-up `UPDATE` would itself fail.

- [ ] **Step 1: Add the flag fixture**

Create `backend/analytics/tests/conftest.py`:

```python
"""Package-local fixtures for analytics tests.

There is deliberately NO cache-clearing fixture here. `backend/conftest.py`
already carries a root autouse `clear_redis_cache` fixture that calls
`cache.clear()` before and after EVERY test in the project, which flushes the
whole logical Redis DB — including this phase's feature-flag cache key. A second,
narrower fixture doing the same job here would be redundant and would imply the
root one cannot be relied on. (Phase 5's Task 6 made the same consolidation for
`services_catalog/tests/`: one fixture, at the outermost level that owns the
problem, and no per-file duplicates.)
"""

import pytest


@pytest.fixture
def view_counting_enabled(db):
    """Spec §35.2 step 9. The flag ships disabled, so every test that expects a
    row to be written must turn it on explicitly.

    Both imports are function-local on purpose: this conftest is collected for
    the whole `analytics/tests/` package, and `analytics.recording` does not
    exist until Step 4 of this task. A module-level import would fail collection
    for every test file in the package — including the Task 2 and Task 3 suites
    that are already green — rather than only for the file under construction.
    """
    from platform_settings.services import set_feature_flag

    from analytics.recording import UNIQUE_LISTING_VIEWS_FLAG

    set_feature_flag(key=UNIQUE_LISTING_VIEWS_FLAG, is_enabled=True, actor=None)
```

- [ ] **Step 2: Write the failing test**

Create `backend/analytics/tests/test_recording.py`:

```python
"""Spec §19.3's write path, step by step.

"The count must not increment on refresh, repeated API fetch or a second browser
using the same anonymous IP" is the sentence this file exists to prove, and it is
proved for both identity kinds and under a simulated race.
"""

import pytest
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from analytics.enums import UserAgentClass, ViewerType
from analytics.models import ListingView
from analytics.policies import ViewerIdentity, resolve_viewer_identity
from analytics.recording import record_listing_view
from common.ip import hash_client_ip
from listings.enums import ListingStatus
from listings.models import BoatListing
from listings.tests.factories import make_private_listing, make_snapshot

pytestmark = pytest.mark.django_db

CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0.0.0 Safari/537.36"


@pytest.fixture
def factory():
    return APIRequestFactory()


@pytest.fixture
def listing(db):
    owner = make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(owner=owner)
    snapshot = make_snapshot(listing, approved_by=owner)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])
    return listing


def _request(factory, *, user=None, remote_addr="198.51.100.9", user_agent=CHROME):
    request = factory.get(
        "/api/v1/listings/x/", REMOTE_ADDR=remote_addr, HTTP_USER_AGENT=user_agent
    )
    request.user = user if user is not None else AnonymousUser()
    return request


def _count(listing):
    return BoatListing.objects.values_list("view_count_cached", flat=True).get(
        pk=listing.pk
    )


def test_the_first_eligible_anonymous_view_creates_a_row_and_increments(
    factory, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0

    result = record_listing_view(listing=listing, request=_request(factory))

    assert result.counted is True
    assert _count(listing) == 1
    view = ListingView.objects.get()
    assert view.listing_id == listing.pk
    assert view.viewer_type == ViewerType.ANONYMOUS
    assert view.viewer_hash == hash_client_ip("198.51.100.9")
    assert view.user_agent_class == UserAgentClass.HUMAN


def test_a_refresh_from_the_same_address_touches_last_seen_and_does_not_increment(
    factory, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    record_listing_view(listing=listing, request=_request(factory))
    first = ListingView.objects.get()

    result = record_listing_view(listing=listing, request=_request(factory))

    assert result.counted is False
    assert ListingView.objects.count() == 1
    assert _count(listing) == 1
    refreshed = ListingView.objects.get()
    assert refreshed.pk == first.pk
    assert refreshed.first_viewed_at == first.first_viewed_at
    assert refreshed.last_seen_at > first.last_seen_at


def test_a_second_browser_on_the_same_address_does_not_increment(
    factory, listing, view_counting_enabled, settings
):
    """Spec §19.3, verbatim: "...or a second browser using the same anonymous IP."
    Spec §19.2 accepts this: "A household sharing an IP may count as one
    anonymous viewer." """
    settings.TRUSTED_PROXY_COUNT = 0
    record_listing_view(listing=listing, request=_request(factory, user_agent=CHROME))

    record_listing_view(
        listing=listing,
        request=_request(factory, user_agent="Mozilla/5.0 Firefox/130.0"),
    )

    assert ListingView.objects.count() == 1
    assert _count(listing) == 1


def test_a_different_address_is_a_different_viewer(
    factory, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    record_listing_view(listing=listing, request=_request(factory, remote_addr="198.51.100.9"))
    record_listing_view(listing=listing, request=_request(factory, remote_addr="203.0.113.5"))

    assert ListingView.objects.count() == 2
    assert _count(listing) == 2


def test_two_authenticated_viewers_count_as_two(factory, listing, view_counting_enabled):
    """Spec §19's acceptance test 3."""
    first = make_user("buyer-one@example.com", role=UserRole.BUYER)
    second = make_user("buyer-two@example.com", role=UserRole.BUYER)

    record_listing_view(listing=listing, request=_request(factory, user=first))
    record_listing_view(listing=listing, request=_request(factory, user=second))
    # ...and each of them refreshing changes nothing.
    record_listing_view(listing=listing, request=_request(factory, user=first))
    record_listing_view(listing=listing, request=_request(factory, user=second))

    assert ListingView.objects.count() == 2
    assert _count(listing) == 2


def test_the_same_person_anonymously_then_signed_in_counts_twice_by_design(
    factory, listing, view_counting_enabled, settings
):
    """Spec §19.2: "If an anonymous viewer later logs in, the authenticated
    identity may count separately; do not attempt risky probabilistic identity
    merging." This is the documented behaviour, not an accident."""
    settings.TRUSTED_PROXY_COUNT = 0
    buyer = make_user("buyer@example.com", role=UserRole.BUYER)

    record_listing_view(listing=listing, request=_request(factory))
    record_listing_view(listing=listing, request=_request(factory, user=buyer))

    assert _count(listing) == 2
    assert set(ListingView.objects.values_list("viewer_type", flat=True)) == {
        ViewerType.ANONYMOUS,
        ViewerType.USER,
    }


def test_an_ineligible_request_writes_nothing_at_all(factory, listing, view_counting_enabled):
    result = record_listing_view(
        listing=listing, request=_request(factory, user=listing.owner_user)
    )

    assert result.counted is False
    assert result.identity is None
    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_nothing_is_written_while_the_feature_flag_is_off(factory, listing, settings):
    """Spec §35.1: "Flags gate both frontend exposure and backend mutation."
    No `view_counting_enabled` fixture here — the flag ships disabled."""
    settings.TRUSTED_PROXY_COUNT = 0

    result = record_listing_view(listing=listing, request=_request(factory))

    assert result.counted is False
    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_a_concurrent_duplicate_yields_one_row_and_one_increment(
    factory, listing, view_counting_enabled, settings
):
    """Spec §19's acceptance test 5, realised deterministically.

    Two real DB connections racing inside pytest-django is fragile and would end
    up proving Postgres' unique index rather than this function's handling of it
    (the same reasoning Phase 11's Task 15 recorded for §34.2). The equivalent
    that exercises the exact branch: the row the loser is about to create already
    exists by the time its INSERT lands, which is what the winner's commit does
    to it. The loser must touch, not raise, and must not increment.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    request = _request(factory)
    identity = resolve_viewer_identity(request=request, listing=listing)
    # The "winner": the row is in place before the loser's call runs.
    now = timezone.now()
    ListingView.objects.create(
        listing=listing,
        viewer_type=identity.viewer_type,
        viewer_user=identity.viewer_user,
        viewer_hash=identity.viewer_hash,
        first_viewed_at=now,
        last_seen_at=now,
        user_agent_class=identity.user_agent_class,
    )
    BoatListing.objects.filter(pk=listing.pk).update(view_count_cached=1)

    result = record_listing_view(listing=listing, request=request)

    assert result.counted is False
    assert ListingView.objects.count() == 1
    assert _count(listing) == 1


def test_a_non_uniqueness_integrity_error_propagates_instead_of_being_swallowed(
    factory, listing, view_counting_enabled, settings, monkeypatch
):
    """The `except IntegrityError` branch must not absorb real bugs.

    Every constraint on ListingView raises IntegrityError, not just the unique
    indexes. Here the hash-format constraint is violated (uppercase hex), which
    is a bug in the caller, not a race: no row exists, so the fallback UPDATE
    matches nothing. The function must re-raise rather than report "already
    counted, nothing to do" — spec §39 and the plan's "recording failures are not
    swallowed" ruling. Without the affected-row check this test fails by
    returning ViewRecordResult(counted=False) with an empty table.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    import analytics.recording as recording

    broken = ViewerIdentity(
        viewer_type=ViewerType.ANONYMOUS,
        viewer_user=None,
        viewer_hash="A" * 64,  # uppercase: rejected by the hash-format CHECK
        user_agent_class=UserAgentClass.HUMAN,
    )
    monkeypatch.setattr(
        recording, "resolve_viewer_identity", lambda **kwargs: broken
    )

    with pytest.raises(IntegrityError):
        record_listing_view(listing=listing, request=_request(factory))

    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_the_increment_does_not_bump_the_optimistic_locking_version_or_updated_at(
    factory, listing, view_counting_enabled, settings
):
    """A view is not an edit. Bumping `version` would hand the seller a spurious
    409 stale_version (spec §20.5) for merely being browsed, and touching
    `updated_at` would forge an edit timestamp."""
    settings.TRUSTED_PROXY_COUNT = 0
    before = BoatListing.objects.values("version", "updated_at").get(pk=listing.pk)

    record_listing_view(listing=listing, request=_request(factory))

    after = BoatListing.objects.values("version", "updated_at").get(pk=listing.pk)
    assert after == before
    assert _count(listing) == 1


def test_views_of_one_listing_do_not_affect_another(
    factory, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    other_owner = make_user("owner-two@example.com", role=UserRole.PRIVATE_SELLER)
    other = make_private_listing(owner=other_owner)
    other.status = ListingStatus.PUBLISHED
    other.current_public_snapshot = make_snapshot(other, approved_by=other_owner)
    other.save(update_fields=["status", "current_public_snapshot", "updated_at"])

    record_listing_view(listing=listing, request=_request(factory))

    assert _count(listing) == 1
    assert _count(other) == 0
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd backend && uv run pytest analytics/tests/test_recording.py -v`

Expected: FAIL — collection error, `ModuleNotFoundError: No module named 'analytics.recording'`. Note that `analytics/tests/conftest.py` (Step 1) imports `analytics.recording` only *inside* its fixture, so the rest of the `analytics/tests/` package still collects and passes at this point; only this one file errors.

- [ ] **Step 4: Write the recorder**

Create `backend/analytics/recording.py`:

```python
"""Spec §19.3's write path. The single writer of ListingView and of
BoatListing.view_count_cached.

    1. Resolve viewer identity.                     -> analytics.policies
    2. INSERT ... ON CONFLICT DO UPDATE last_seen_at -> _insert_or_touch below
    3. Increment view_count_cached ONLY on insert.   -> _increment below
    4. Short transaction; do not delay rendering.    -> see the module notes
    5. Reconciliation task.                          -> analytics.tasks

On (4): spec §19.3 says "do not delay page rendering **if an async durable event
pipeline already exists**". None does — `common/tasks.py` holds a single `ping`
task and there is no durable event outbox anywhere in this repository — so the
write happens in-request. It is one INSERT (or one UPDATE) on a unique index plus,
only on insertion, one single-column UPDATE by primary key. If a durable pipeline
is ever built, this function is the one place that moves behind it.

Errors are NOT swallowed. The IntegrityError raised by the unique index is an
expected outcome of two viewers racing and is handled precisely; anything else is
a fault and propagates to the standard spec §30.2 envelope, because an analytics
path that fails silently is an analytics path nobody ever fixes.
"""

from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from listings.models import BoatListing
from platform_settings.services import is_feature_enabled

from .models import ListingView
from .policies import ViewerIdentity, resolve_viewer_identity

# Spec §35.1's flag list. §35.2 step 9 ("Enable finance and view counting") is
# when this goes on in production.
UNIQUE_LISTING_VIEWS_FLAG = "unique_listing_views"


@dataclass(frozen=True)
class ViewRecordResult:
    """`counted` is True only when a NEW unique row was inserted — i.e. only when
    `view_count_cached` moved. Callers use it to decide whether to re-read."""

    counted: bool
    identity: ViewerIdentity | None


def _insert_or_touch(*, listing, identity: ViewerIdentity, now) -> bool:
    """Spec §19.3 step 2. Returns True when a new row was inserted.

    The savepoint is load-bearing, not decoration: an IntegrityError marks the
    surrounding transaction unusable in Postgres, so without `atomic()` here the
    UPDATE in the except branch would itself fail with InFailedSqlTransaction.
    This is the same shape `QuerySet.get_or_create()` uses internally.

    `first_viewed_at` and `last_seen_at` both receive the SAME captured `now`.
    Neither column auto-generates (see analytics/models.py): an `auto_now_add`
    `first_viewed_at` would be stamped after this `now` and every first insert
    would violate the `last_seen_at >= first_viewed_at` CHECK.
    """
    try:
        with transaction.atomic():
            ListingView.objects.create(
                listing=listing,
                viewer_type=identity.viewer_type,
                viewer_user=identity.viewer_user,
                viewer_hash=identity.viewer_hash,
                first_viewed_at=now,
                last_seen_at=now,
                user_agent_class=identity.user_agent_class,
            )
    except IntegrityError:
        # `IntegrityError` is the exception class for EVERY constraint on this
        # table, not just the unique indexes: a malformed hash, a viewer_type
        # that disagrees with the identity column, or a timestamp inversion all
        # raise it too. Only ONE of those is a legitimate, expected outcome — the
        # uniqueness race — and the difference is observable: if the row this
        # error implies already exists really does exist, the UPDATE below finds
        # it. When it matches zero rows, the IntegrityError was NOT a uniqueness
        # race, there is no row, and nothing was recorded. Swallowing that and
        # returning False would be exactly the silent, permanent undercount the
        # "recording failures are not swallowed" ruling forbids, so it is
        # re-raised with its original traceback.
        touched = ListingView.objects.filter(
            listing=listing, **identity.lookup()
        ).update(last_seen_at=now)
        if not touched:
            raise
        return False
    return True


def _increment(listing) -> None:
    """Spec §19.3 step 3.

    QuerySet.update() writes exactly the named column: it does not fire
    `auto_now` on `updated_at` and it does not touch `version`. Both omissions
    are deliberate — a view is not an edit, and bumping `version` would give the
    seller a spurious `409 stale_version` (spec §20.5) for being browsed. This is
    also why the increment does not go through listings.locking.bump_version
    (Phase 11 contract rule 4 governs state-changing endpoints; this is not one).

    F() rather than a read-modify-write: two concurrent increments must both
    land, and only the database can guarantee that.
    """
    BoatListing.objects.filter(pk=listing.pk).update(
        view_count_cached=F("view_count_cached") + 1
    )


def record_listing_view(*, listing, request) -> ViewRecordResult:
    """Record one view of `listing` by whoever made `request`.

    Safe to call on every public detail read: it decides for itself whether the
    request counts (spec §19.1) and returns without writing when it does not.
    """
    if not is_feature_enabled(UNIQUE_LISTING_VIEWS_FLAG, default=False):
        return ViewRecordResult(counted=False, identity=None)

    identity = resolve_viewer_identity(request=request, listing=listing)
    if identity is None:
        return ViewRecordResult(counted=False, identity=None)

    now = timezone.now()
    with transaction.atomic():
        inserted = _insert_or_touch(listing=listing, identity=identity, now=now)
        if inserted:
            _increment(listing)

    return ViewRecordResult(counted=inserted, identity=identity)
```

- [ ] **Step 5: Seed the feature flag, disabled**

Create `backend/analytics/migrations/0002_seed_unique_listing_views_flag.py`:

```python
from django.db import migrations

FLAG_KEY = "unique_listing_views"
FLAG_DESCRIPTION = (
    "Spec §35.1 rollout flag. Gates the ListingView write and the "
    "view_count_cached increment — NOT the public listing read, which stays "
    "open. Seeded disabled so code can ship ahead of the feature (spec §35.2 "
    "step 4); step 9 turns it on."
)


def create_flag(apps, schema_editor):
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.get_or_create(
        key=FLAG_KEY,
        defaults={"is_enabled": False, "description": FLAG_DESCRIPTION},
    )


def delete_flag(apps, schema_editor):
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.filter(key=FLAG_KEY).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("analytics", "0001_listingview"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [migrations.RunPython(create_flag, delete_flag)]
```

Before committing, confirm `0004_featureflag` is the real migration name that creates `FeatureFlag`:

Run: `cd backend && uv run python manage.py showmigrations platform_settings`

If the name differs, use the actual one — the dependency must point at the migration that creates the table, not at the app's leaf.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && uv run pytest analytics/tests/test_recording.py -v`
Expected: PASS — 12 tests.

- [ ] **Step 7: Verify the flag really was seeded, and seeded off**

Run: `cd backend && uv run python manage.py migrate && uv run python manage.py shell -c "from platform_settings.models import FeatureFlag; print(FeatureFlag.objects.get(key='unique_listing_views').is_enabled)"`

Expected: `False`.

- [ ] **Step 8: Run the analytics suite and the full backend suite**

Run: `cd backend && uv run pytest analytics/ -q && uv run pytest -q`
Expected: PASS both.

- [ ] **Step 9: Commit**

```bash
git add backend/analytics/recording.py backend/analytics/migrations/0002_seed_unique_listing_views_flag.py backend/analytics/tests/conftest.py backend/analytics/tests/test_recording.py
git commit -m "feat(analytics): spec 19.3 unique view write path behind unique_listing_views"
```

---

### Task 5: Wire the recorder into `GET /api/v1/listings/<id>/` — spec §30.1's "counted-view integration"

The only change this phase makes inside `backend/listings/`. It also restores credential parsing on the detail endpoint, without which three of spec §19.1's five exclusions cannot be evaluated at all.

**Files:**
- Create: `backend/common/authentication.py`
- Create: `backend/common/tests/test_authentication.py`
- Modify: `backend/listings/views.py` (imports; `PublicListingDetailView` only — `PublicListingReadView`, `PublicListingListView`, `published_listings_queryset` and every workflow view stay byte-for-byte unchanged)
- Create: `backend/analytics/tests/test_detail_view_counting.py`

**Interfaces:**
- Consumes: `analytics.recording.record_listing_view` (Task 4); `rest_framework_simplejwt.authentication.JWTAuthentication`.
- Produces: `common.authentication.OptionalJWTAuthentication` — a `JWTAuthentication` subclass whose `authenticate()` returns `None` instead of raising `AuthenticationFailed`.

**Note (ruling — why `authentication_classes = []` cannot simply stay).** Phase 11 set it deliberately, with a good reason recorded in `PublicListingReadView`'s docstring: "Dropping authentication only means an expired or malformed Authorization header cannot turn a public page into a 401, and that no credential is parsed on an anonymous read path." The first half of that reason is preserved exactly by `OptionalJWTAuthentication`. The second half has to give: with no authentication at all, `request.user` is always `AnonymousUser`, so the owner, broker-colleague and staff exclusions in spec §19.1 are unreachable and a signed-in owner would be counted as an anonymous IP — the precise failure spec §34.7's release checklist forbids ("owner/staff/bot excluded"). The change is scoped to the detail view; the list view, which records nothing, keeps `authentication_classes = []`.

- [ ] **Step 1: Write the failing authentication test**

Create `backend/common/tests/test_authentication.py`:

```python
"""OptionalJWTAuthentication: identify the caller when possible, never 401.

Used by public read endpoints that must distinguish a signed-in viewer from a
guest (spec §19.1's owner/staff/broker exclusions) while remaining open to guests.
"""

import pytest
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory
from rest_framework_simplejwt.tokens import AccessToken

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from common.authentication import OptionalJWTAuthentication

pytestmark = pytest.mark.django_db


def _request(authorization=None):
    extra = {"HTTP_AUTHORIZATION": authorization} if authorization else {}
    return APIRequestFactory().get("/api/v1/listings/x/", **extra)


def test_no_header_authenticates_nobody_and_raises_nothing():
    assert OptionalJWTAuthentication().authenticate(_request()) is None


def test_a_valid_token_identifies_the_user():
    user = make_user("buyer@example.com", role=UserRole.BUYER)
    token = AccessToken.for_user(user)

    result = OptionalJWTAuthentication().authenticate(_request(f"Bearer {token}"))

    assert result is not None
    assert result[0] == user


@pytest.mark.parametrize(
    "authorization",
    [
        "Bearer not-a-token",
        "Bearer ",
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJmb28iOiJiYXIifQ.zzzzzzzzzzzz",
    ],
)
def test_a_broken_token_degrades_to_anonymous_instead_of_401(authorization):
    """Phase 11's reason for authentication_classes = [] on the public read path,
    preserved: "an expired or malformed Authorization header cannot turn a public
    page into a 401"."""
    assert OptionalJWTAuthentication().authenticate(_request(authorization)) is None


def test_a_token_for_a_deleted_user_degrades_to_anonymous():
    user = make_user("gone@example.com", role=UserRole.BUYER)
    token = str(AccessToken.for_user(user))
    user.delete()

    assert OptionalJWTAuthentication().authenticate(_request(f"Bearer {token}")) is None


def test_it_still_refuses_to_invent_an_identity():
    """Regression pin: the class must swallow AuthenticationFailed, not everything.
    A subclass that caught bare Exception would hide real configuration faults."""
    authenticator = OptionalJWTAuthentication()

    with pytest.raises(ValueError):
        authenticator.get_user({"user_id": None, "token_type": "access"})

    assert issubclass(AuthenticationFailed, Exception)
```

**Note:** the final test's exact exception depends on SimpleJWT's internals. Before writing the implementation, run `cd backend && uv run python -c "from rest_framework_simplejwt.authentication import JWTAuthentication; help(JWTAuthentication.get_user)"` and confirm what a payload with no recognisable user id raises in the installed version (`>=5.5.1`). If it raises `InvalidToken` rather than `ValueError`, change the test to assert `pytest.raises(InvalidToken)` — but do **not** delete the test: its purpose is to pin that the subclass narrows its `except` to `AuthenticationFailed` and its subclasses, and `InvalidToken` is one of those, so in that case rewrite it as an assertion that `OptionalJWTAuthentication` defines no `except Exception` (`"except Exception" not in inspect.getsource(OptionalJWTAuthentication)`).

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && uv run pytest common/tests/test_authentication.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'common.authentication'`.

- [ ] **Step 3: Write the authentication class**

Create `backend/common/authentication.py`:

```python
"""Authentication classes for endpoints that are public but identity-aware.

A public page must not 401 because someone's access token expired in a background
tab. It must nonetheless know who is looking, when a rule depends on it — spec
§19.1 excludes "the private listing owner", "the owning broker organization" and
"staff" from view counting, and none of those is decidable against AnonymousUser.
"""

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class OptionalJWTAuthentication(JWTAuthentication):
    """Identify the caller when the credential is good; otherwise stay anonymous.

    The `except` is narrowed to AuthenticationFailed on purpose. SimpleJWT's
    InvalidToken and TokenError-derived failures are subclasses of it, so every
    bad-credential case is covered — while a genuine misconfiguration (a missing
    signing key, an unimportable user model) still raises and is still visible.
    A bare `except Exception` here would silently turn "auth is broken in
    production" into "everyone is a guest".

    This class grants nothing. `permission_classes` still decides access; all this
    does is populate `request.user` when it honestly can.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            return None
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && uv run pytest common/tests/test_authentication.py -v`
Expected: PASS — 7 tests.

- [ ] **Step 5: Write the failing endpoint test**

Create `backend/analytics/tests/test_detail_view_counting.py`:

```python
"""Spec §30.1: `GET /api/v1/listings/<id>/` — "public detail and counted-view
integration". Spec §19.1: "Search-result card impressions do not count."

These go through real HTTP against the real routes, because the integration is a
statement about what the endpoint does, not about what the service can be made to
do.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from analytics.models import ListingView
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus
from listings.models import BoatListing
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)

pytestmark = pytest.mark.django_db

CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0.0.0 Safari/537.36"


@pytest.fixture
def api():
    client = APIClient(HTTP_USER_AGENT=CHROME, REMOTE_ADDR="198.51.100.9")
    return client


def _publish(listing, approver):
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = make_snapshot(listing, approved_by=approver)
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])
    return listing


@pytest.fixture
def owner():
    return make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)


@pytest.fixture
def listing(owner):
    return _publish(make_private_listing(owner=owner), owner)


def _detail_url(listing):
    return reverse("listing-detail", kwargs={"listing_id": listing.pk})


def _count(listing):
    return BoatListing.objects.values_list("view_count_cached", flat=True).get(
        pk=listing.pk
    )


def _as(client, user):
    """A real Authorization header, not force_authenticate: the point of these
    tests is that the endpoint parses credentials again at all."""
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
    return client


def test_a_guest_detail_read_counts_once_and_the_body_shows_it(
    api, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0

    response = api.get(_detail_url(listing))

    assert response.status_code == 200
    assert response.data["view_count"] == 1
    assert _count(listing) == 1


def test_repeated_reads_from_one_client_stay_at_one(
    api, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    api.get(_detail_url(listing))

    response = api.get(_detail_url(listing))

    assert response.data["view_count"] == 1
    assert ListingView.objects.count() == 1


def test_the_list_endpoint_never_counts(api, listing, view_counting_enabled, settings):
    """Spec §19.1: "Search-result card impressions do not count.\""""
    settings.TRUSTED_PROXY_COUNT = 0

    response = api.get(reverse("listing-list"))

    assert response.status_code == 200
    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_a_head_request_does_not_count(api, listing, view_counting_enabled, settings):
    """Spec §19.1 excludes HEAD explicitly."""
    settings.TRUSTED_PROXY_COUNT = 0

    response = api.head(_detail_url(listing))

    assert response.status_code == 200
    assert ListingView.objects.count() == 0


def test_the_signed_in_owner_does_not_count(api, listing, view_counting_enabled, settings):
    settings.TRUSTED_PROXY_COUNT = 0

    response = _as(api, listing.owner_user).get(_detail_url(listing))

    assert response.status_code == 200
    assert response.data["view_count"] == 0
    assert ListingView.objects.count() == 0


def test_a_signed_in_broker_colleague_does_not_count(api, view_counting_enabled, settings):
    settings.TRUSTED_PROXY_COUNT = 0
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker)
    listing = _publish(make_broker_listing(broker=broker, actor=agent), agent)

    _as(api, agent).get(_detail_url(listing))

    assert ListingView.objects.count() == 0


def test_signed_in_staff_does_not_count(api, listing, view_counting_enabled, settings):
    settings.TRUSTED_PROXY_COUNT = 0
    staff = make_user("mod@example.com", role=UserRole.STAFF)
    staff.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))

    _as(api, staff).get(_detail_url(listing))

    assert ListingView.objects.count() == 0


def test_a_signed_in_buyer_counts_as_themselves_not_as_their_ip(
    api, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    buyer = make_user("buyer@example.com", role=UserRole.BUYER)

    _as(api, buyer).get(_detail_url(listing))

    view = ListingView.objects.get()
    assert view.viewer_user_id == buyer.pk
    assert view.viewer_hash is None


def test_a_bot_user_agent_does_not_count(listing, view_counting_enabled, settings):
    settings.TRUSTED_PROXY_COUNT = 0
    client = APIClient(HTTP_USER_AGENT="Googlebot/2.1", REMOTE_ADDR="198.51.100.9")

    response = client.get(_detail_url(listing))

    assert response.status_code == 200
    assert ListingView.objects.count() == 0


def test_a_prefetch_does_not_count(api, listing, view_counting_enabled, settings):
    settings.TRUSTED_PROXY_COUNT = 0

    api.get(_detail_url(listing), HTTP_SEC_PURPOSE="prefetch;prerender")

    assert ListingView.objects.count() == 0


def test_a_broken_authorization_header_still_serves_the_page_as_a_guest(
    api, listing, view_counting_enabled, settings
):
    """Phase 11's reason for dropping authentication here, preserved."""
    settings.TRUSTED_PROXY_COUNT = 0
    api.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")

    response = api.get(_detail_url(listing))

    assert response.status_code == 200
    assert response.data["view_count"] == 1


def test_an_unpublished_listing_is_still_404_and_records_nothing(
    api, owner, view_counting_enabled
):
    draft = make_private_listing(owner=owner)

    response = api.get(_detail_url(draft))

    assert response.status_code == 404
    assert ListingView.objects.count() == 0


def test_nothing_is_recorded_while_the_flag_is_off(api, listing, settings):
    settings.TRUSTED_PROXY_COUNT = 0

    response = api.get(_detail_url(listing))

    assert response.status_code == 200
    assert response.data["view_count"] == 0
    assert ListingView.objects.count() == 0


def test_the_detail_response_is_never_cacheable_by_a_shared_cache(
    api, listing, view_counting_enabled, settings
):
    """Spec §36.2 anticipates CDN/page caching in front of this endpoint.

    Since Task 5 the body varies by Authorization and by client IP, so a shared
    cache storing one visitor's copy would serve that visitor's personalised
    `view_count` to everyone behind it. The header must be present on every
    response, counted or not — a response that is only sometimes uncacheable is
    a response whose cacheable copy gets stored and replayed.
    """
    settings.TRUSTED_PROXY_COUNT = 0

    counted = api.get(_detail_url(listing))  # first view: increments
    repeat = api.get(_detail_url(listing))  # second view: does not

    for response in (counted, repeat):
        assert response["Cache-Control"] == "private, no-store"
        assert "Authorization" in response["Vary"]


def test_no_viewer_identity_appears_anywhere_in_the_public_payload(
    api, listing, view_counting_enabled, settings
):
    """Spec §19.4: "Never expose viewer identities to sellers; only aggregate
    count." The assertion is over the serialized bytes, not over known keys, so a
    field added later by another phase cannot smuggle one in unnoticed."""
    settings.TRUSTED_PROXY_COUNT = 0
    buyer = make_user("buyer@example.com", role=UserRole.BUYER)
    _as(api, buyer).get(_detail_url(listing))
    api.credentials()

    body = api.get(_detail_url(listing)).content.decode()
    stored = ListingView.objects.exclude(viewer_hash=None).get()

    assert str(buyer.pk) not in body
    assert buyer.email not in body
    assert stored.viewer_hash not in body
    assert "viewer" not in body
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd backend && uv run pytest analytics/tests/test_detail_view_counting.py -v`
Expected: FAIL — the counting tests fail with `view_count == 0` and zero rows (nothing is wired up yet), and `test_the_detail_response_is_never_cacheable_by_a_shared_cache` fails with a missing `Cache-Control` header; the owner/staff/broker tests pass vacuously for now.

- [ ] **Step 7: Wire the hook into the detail view**

In `backend/listings/views.py`, add to the module's import section:

```python
from django.utils.cache import patch_vary_headers
from rest_framework.generics import ListAPIView, RetrieveAPIView  # already present

from analytics.recording import record_listing_view
from common.authentication import OptionalJWTAuthentication
```

Then replace the existing `PublicListingDetailView` class (the last class in the file) with:

```python
class PublicListingDetailView(PublicListingReadView, RetrieveAPIView):
    """GET /api/v1/listings/<id>/ — public detail (spec §30.1).

    Returns 404 for anything not published, including to the listing's owner:
    the owner's view of their own work comes from the workflow endpoints.

    Spec §30.1 annotates this endpoint "public detail and counted-view
    integration", so this is where spec §19's unique view is recorded. Two
    deliberate departures from the shared PublicListingReadView configuration:

    1. `authentication_classes` is restored — as OptionalJWTAuthentication, which
       never 401s. Phase 11 dropped authentication here so that "an expired or
       malformed Authorization header cannot turn a public page into a 401"; that
       property is kept, because the class swallows AuthenticationFailed and
       returns None. But three of spec §19.1's five exclusions (owner, owning
       broker's members, staff) are statements about `request.user`, and with no
       authentication at all `request.user` is always AnonymousUser — a signed-in
       owner would have been counted as an anonymous IP. `permission_classes`
       stays `[AllowAny]`: this parses a credential, it does not require one.
    2. `retrieve()` is overridden to record. The list view is NOT changed —
       spec §19.1: "Search-result card impressions do not count."

    The re-read after a counted view is one indexed single-column query and only
    happens when a row was actually inserted. It is there so the viewer who just
    became view number one is not served a zero, and it is a re-read rather than
    an in-memory increment so the number stays right when others are viewing
    concurrently.

    That re-read is also why this response is no longer cacheable by a SHARED
    cache. Before this phase the body was identical for every caller. It now
    varies by `Authorization` (an owner/staff/broker viewer is excluded and sees
    the unincremented number) and by client IP (a first-time anonymous viewer
    sees N+1 where a returning one sees N) — so a CDN or reverse-proxy cache that
    stored one visitor's copy would serve that visitor's personalised
    `view_count` to everybody behind it. Spec §36.2 explicitly anticipates
    CDN/page caching in front of this endpoint, so the guard is set here rather
    than assumed: `Cache-Control: private, no-store` on the response, plus a
    `Vary: Authorization` for any intermediary that honours `Vary` but not
    `private`. `private, no-store` is the right pair here rather than a max-age —
    a per-browser copy of a counter that changed the instant it was read has no
    value, and `no-store` also keeps the identity-dependent body out of
    intermediary disk caches.
    """

    lookup_url_kwarg = "listing_id"
    authentication_classes = [OptionalJWTAuthentication]

    def retrieve(self, request, *args, **kwargs):
        listing = self.get_object()
        if record_listing_view(listing=listing, request=request).counted:
            listing.refresh_from_db(fields=["view_count_cached"])
        response = Response(self.get_serializer(listing).data)
        # This body depends on who is asking (see the class docstring). A shared
        # cache must never hand one viewer's copy to another.
        response["Cache-Control"] = "private, no-store"
        # patch_vary_headers, not `response["Vary"] = ...`: Django's own
        # middleware appends Cookie / Accept-Language to this header after the
        # view returns, and a direct assignment would be clobbered or would
        # clobber them depending on order. patch_vary_headers merges.
        patch_vary_headers(response, ("Authorization",))
        return response
```

`Response` is already imported at the top of the file; do not add a second import. `patch_vary_headers` is new — add `from django.utils.cache import patch_vary_headers` to the module's import section alongside the two imports in the block above.

**Note:** the header is set unconditionally, not only when a view was counted. A response that is cacheable on some requests and not on others is a response whose first cacheable copy gets stored and replayed for the rest — the condition must not depend on the request. `PublicListingListView` is deliberately untouched: it records nothing and its body is still identity-independent.

- [ ] **Step 8: Run the endpoint test to verify it passes**

Run: `cd backend && uv run pytest analytics/tests/test_detail_view_counting.py -v`
Expected: PASS — 15 tests.

- [ ] **Step 9: Re-run Phase 11's own public read suite for regressions**

Run: `cd backend && uv run pytest listings/ -v`

Expected: PASS, unchanged. `listings/tests/test_public_read_api.py` is the suite that proves no pending listing leaks; this task changed the class it tests, so its continued green is the evidence that the change is additive. If `test_the_public_routes_do_not_shadow_the_workflow_routes` or any 404-leak test fails, stop and fix the view — do not touch the test.

- [ ] **Step 10: Run the full backend suite**

Run: `cd backend && uv run pytest -q`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add backend/common/authentication.py backend/common/tests/test_authentication.py backend/listings/views.py backend/analytics/tests/test_detail_view_counting.py
git commit -m "feat(listings): record a unique view on the public detail read"
```

---

### Task 6: Reconciliation task, management command and the §19.4 retention record

Spec §19.3 step 5 ("Provide a reconciliation task that recomputes cached counts from rows"), spec §35.2 step 3 ("Run bounded backfills and reconciliation"), and spec §19.4's "document the purpose/retention".

**Files:**
- Create: `backend/analytics/tasks.py`
- Create: `backend/analytics/management/__init__.py` (empty)
- Create: `backend/analytics/management/commands/__init__.py` (empty)
- Create: `backend/analytics/management/commands/reconcile_listing_views.py`
- Create: `backend/analytics/tests/test_reconciliation.py`
- Create: `docs/privacy/listing-view-analytics.md`
- Modify: `backend/config/settings/base.py` (one entry in `CELERY_TASK_ROUTES`)

**Interfaces:**
- Consumes: `analytics.models.ListingView` (Task 2); `listings.models.BoatListing`; `audit.services.record_audit_event`, `audit.models.AuditEvent` (Phase 2/3); `celery.shared_task`.
- Produces:
  - `analytics.tasks.RECONCILIATION_BATCH_SIZE = 500`
  - `analytics.tasks.reconcile_listing_view_counts(*, batch_size=RECONCILIATION_BATCH_SIZE, listing_ids=None) -> dict` — the Celery task, returning `{"checked": int, "corrected": int, "drift": int}`. `drift` is the sum of absolute differences it repaired.
  - Management command `reconcile_listing_views`, accepting `--batch-size` and `--listing-id` (repeatable).

**Note (ruling — reconciliation is eventually consistent and says so).** Recomputing `COUNT(*)` and writing it back can lose an increment that lands between the read and the write. The alternative — locking every listing row for the duration — would block the public detail endpoint on a maintenance job, which is a far worse trade for a metric whose own spec calls it "a practical uniqueness control, not a perfect identity claim" (§11.7). The task therefore converges rather than guaranteeing an instantaneous fixpoint, processes a bounded batch at a time (§35.2 step 3 says "bounded"), and records an audit event for every correction so drift is visible rather than silently smoothed away.

**Note (ruling — corrections are audited as a SYSTEM/TASK actor).** `audit.services.record_audit_event` requires an actor; there is no user behind a cron run. `actor_user=None`, `actor_type=AuditEvent.ActorType.SYSTEM`, `source=AuditEvent.Source.TASK` is the combination Phase 2 built for exactly this, and the `before`/`after` pair makes each correction reconstructable.

- [ ] **Step 1: Write the failing test**

Create `backend/analytics/tests/test_reconciliation.py`:

```python
"""Spec §19.3 step 5: "Provide a reconciliation task that recomputes cached
counts from rows." Spec §35.2 step 3: "Run bounded backfills and reconciliation."
"""

import pytest
from django.core.management import call_command

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from analytics.tasks import reconcile_listing_view_counts
from analytics.tests.factories import fake_hash, make_anonymous_view, make_user_view
from audit.models import AuditEvent
from listings.models import BoatListing
from listings.tests.factories import make_private_listing

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner():
    return make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)


def _listing(owner, cached=0):
    listing = make_private_listing(owner=owner)
    BoatListing.objects.filter(pk=listing.pk).update(view_count_cached=cached)
    listing.refresh_from_db(fields=["view_count_cached"])
    return listing


def _count(listing):
    return BoatListing.objects.values_list("view_count_cached", flat=True).get(
        pk=listing.pk
    )


def test_a_cached_count_that_is_too_low_is_raised_to_the_row_count(owner):
    listing = _listing(owner, cached=0)
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))
    make_anonymous_view(listing, viewer_hash=fake_hash("b"))
    make_user_view(listing, user=make_user("buyer@example.com", role=UserRole.BUYER))

    report = reconcile_listing_view_counts()

    assert _count(listing) == 3
    assert report["corrected"] == 1
    assert report["drift"] == 3


def test_a_cached_count_that_is_too_high_is_lowered(owner):
    """This is the account-erasure case: CASCADE removed a viewer's rows and the
    cached number is now an overcount. See the plan's ruling."""
    listing = _listing(owner, cached=9)
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))

    reconcile_listing_view_counts()

    assert _count(listing) == 1


def test_a_listing_with_no_views_is_reconciled_to_zero(owner):
    listing = _listing(owner, cached=4)

    reconcile_listing_view_counts()

    assert _count(listing) == 0


def test_a_correct_count_is_left_alone_and_writes_no_audit_event(owner):
    listing = _listing(owner, cached=1)
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))
    before = AuditEvent.objects.count()

    report = reconcile_listing_view_counts()

    assert _count(listing) == 1
    assert report["checked"] == 1
    assert report["corrected"] == 0
    assert AuditEvent.objects.count() == before


def test_running_it_twice_changes_nothing_the_second_time(owner):
    listing = _listing(owner, cached=0)
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))

    reconcile_listing_view_counts()
    second = reconcile_listing_view_counts()

    assert second["corrected"] == 0
    assert _count(listing) == 1


def test_every_correction_is_audited_with_the_before_and_after(owner):
    listing = _listing(owner, cached=7)
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))

    reconcile_listing_view_counts()

    event = AuditEvent.objects.get(action="listing.view_count_reconciled")
    assert event.target_type == "listings.BoatListing"
    assert event.target_id == str(listing.pk)
    assert event.actor_user is None
    assert event.actor_type == AuditEvent.ActorType.SYSTEM
    assert event.source == AuditEvent.Source.TASK
    assert event.before == {"view_count_cached": 7}
    assert event.after == {"view_count_cached": 1}


def test_it_can_be_limited_to_named_listings(owner):
    target = _listing(owner, cached=5)
    untouched = _listing(owner, cached=5)

    report = reconcile_listing_view_counts(listing_ids=[target.pk])

    assert report["checked"] == 1
    assert _count(target) == 0
    assert _count(untouched) == 5


def test_it_processes_every_listing_across_batch_boundaries(owner):
    listings = [_listing(owner, cached=3) for _ in range(5)]

    report = reconcile_listing_view_counts(batch_size=2)

    assert report["checked"] == 5
    assert report["corrected"] == 5
    assert all(_count(listing) == 0 for listing in listings)


def test_the_management_command_runs_the_same_task(owner, capsys):
    listing = _listing(owner, cached=6)
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))

    call_command("reconcile_listing_views", "--batch-size", "2")

    assert _count(listing) == 1
    assert "corrected=1" in capsys.readouterr().out


def test_the_management_command_accepts_specific_listing_ids(owner):
    target = _listing(owner, cached=5)
    untouched = _listing(owner, cached=5)

    call_command("reconcile_listing_views", "--listing-id", str(target.pk))

    assert _count(target) == 0
    assert _count(untouched) == 5
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && uv run pytest analytics/tests/test_reconciliation.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'analytics.tasks'`.

- [ ] **Step 3: Write the task**

Create `backend/analytics/tasks.py`:

```python
"""Spec §19.3 step 5: "Provide a reconciliation task that recomputes cached
counts from rows."

`BoatListing.view_count_cached` is a denormalised counter maintained by
analytics.recording. Denormalised counters drift — a rolled-back transaction, a
CASCADE delete when an account is erased, a future bulk import, a bug. This task
is the authority that puts them back, and spec §35.2 step 3 ("Run bounded
backfills and reconciliation") schedules it into the deployment sequence.

It is eventually consistent by design: an increment landing between the COUNT and
the UPDATE is lost by this pass and repaired by the next. The alternative —
locking each listing row — would block the public detail endpoint on a
maintenance job. Every correction writes an audit event, so drift is visible in
the record rather than quietly smoothed away.
"""

from celery import shared_task
from django.db import transaction
from django.db.models import Count

from audit.models import AuditEvent
from audit.services import record_audit_event
from listings.models import BoatListing

RECONCILIATION_BATCH_SIZE = 500
RECONCILIATION_ACTION = "listing.view_count_reconciled"


def _batches(queryset, batch_size):
    """Bounded iteration by primary key. `iterator()` alone would hold one long
    server-side cursor open across the whole table; keyset pagination keeps every
    query small and lets the task be interrupted without losing its place."""
    last_pk = None
    while True:
        page = queryset
        if last_pk is not None:
            page = page.filter(pk__gt=last_pk)
        rows = list(page.order_by("pk")[:batch_size])
        if not rows:
            return
        yield rows
        last_pk = rows[-1].pk


@shared_task(queue="maintenance")
def reconcile_listing_view_counts(
    *, batch_size: int = RECONCILIATION_BATCH_SIZE, listing_ids=None
) -> dict:
    """Recompute every listing's cached view count from its ListingView rows.

    Returns {"checked": n, "corrected": m, "drift": total absolute difference}.
    `listing_ids` limits the run to specific listings (used by the management
    command and by anyone repairing one row).
    """
    queryset = BoatListing.objects.only("pk", "view_count_cached").annotate(
        actual_views=Count("views", distinct=True)
    )
    if listing_ids:
        queryset = queryset.filter(pk__in=list(listing_ids))

    checked = corrected = drift = 0

    for rows in _batches(queryset, batch_size):
        for listing in rows:
            checked += 1
            if listing.actual_views == listing.view_count_cached:
                continue

            previous = listing.view_count_cached
            drift += abs(listing.actual_views - previous)
            corrected += 1

            # One short transaction per correction: the counter write and its
            # audit event must land together or not at all, and a single long
            # transaction over the whole run would hold locks for minutes.
            with transaction.atomic():
                BoatListing.objects.filter(pk=listing.pk).update(
                    view_count_cached=listing.actual_views
                )
                record_audit_event(
                    actor_user=None,
                    actor_type=AuditEvent.ActorType.SYSTEM,
                    action=RECONCILIATION_ACTION,
                    target_type="listings.BoatListing",
                    target_id=str(listing.pk),
                    source=AuditEvent.Source.TASK,
                    before={"view_count_cached": previous},
                    after={"view_count_cached": listing.actual_views},
                )

    return {"checked": checked, "corrected": corrected, "drift": drift}
```

**Note on `Count("views", distinct=True)`:** `views` is the `related_name` Task 2 gave `ListingView.listing`. `distinct=True` is belt-and-braces — the annotation joins one table, so duplicates cannot arise today, but it keeps the count correct if a later phase adds a second annotation to this queryset.

- [ ] **Step 4: Write the management command**

Create `backend/analytics/management/commands/reconcile_listing_views.py`:

```python
"""Spec §35.2 step 3: "Run bounded backfills and reconciliation."

A thin synchronous wrapper so an operator can reconcile without a broker or a
worker — during a deploy, or when repairing one listing. The behaviour is the
Celery task's, called directly; nothing is duplicated here.
"""

from django.core.management.base import BaseCommand

from analytics.tasks import RECONCILIATION_BATCH_SIZE, reconcile_listing_view_counts


class Command(BaseCommand):
    help = "Recompute BoatListing.view_count_cached from ListingView rows."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=RECONCILIATION_BATCH_SIZE,
            help="Listings per query (default: %(default)s).",
        )
        parser.add_argument(
            "--listing-id",
            action="append",
            dest="listing_ids",
            default=None,
            help="Limit the run to this listing. Repeatable.",
        )

    def handle(self, *args, **options):
        report = reconcile_listing_view_counts(
            batch_size=options["batch_size"], listing_ids=options["listing_ids"]
        )
        self.stdout.write(
            "checked={checked} corrected={corrected} drift={drift}".format(**report)
        )
```

- [ ] **Step 5: Route the task to the maintenance queue**

In `backend/config/settings/base.py`, add one entry to the existing `CELERY_TASK_ROUTES` dict (read the real dict and add a line; do not retype the block):

```python
    "analytics.tasks.*": {"queue": "maintenance"},
```

The `maintenance` queue is already declared in `CELERY_TASK_QUEUES` — no queue is being added.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && uv run pytest analytics/tests/test_reconciliation.py -v`
Expected: PASS — 10 tests.

- [ ] **Step 7: Write the retention record**

Spec §19.4 requires the purpose and retention to be *documented*, not merely implemented. Create `docs/privacy/listing-view-analytics.md`:

```markdown
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
```

- [ ] **Step 8: Run the analytics suite and the full backend suite**

Run: `cd backend && uv run pytest analytics/ -q && uv run pytest -q`
Expected: PASS both.

- [ ] **Step 9: Commit**

```bash
git add backend/analytics/tasks.py backend/analytics/management backend/analytics/tests/test_reconciliation.py backend/config/settings/base.py docs/privacy/listing-view-analytics.md
git commit -m "feat(analytics): view-count reconciliation task, command and retention record"
```

---

### Task 7: Frontend — the localized view-count formatter and the accessible `<ViewCount>` component

Spec §19.5's numeric and accessibility rules, delivered as a tested formatter and one component. Phase 20 mounts it on the boat card; per the ruling above, no card exists to mount it on yet and inventing one is forbidden by spec §2.1.

**Files:**
- Create: `frontend/src/lib/listings/view-count.ts`
- Create: `frontend/src/lib/listings/view-count.test.ts`
- Create: `frontend/src/lib/i18n/listings.ts`
- Create: `frontend/src/lib/i18n/listings.test.ts`
- Create: `frontend/src/components/listings/ViewCount.tsx`
- Create: `frontend/src/components/listings/ViewCount.test.tsx`

**Interfaces:**
- Consumes: `Locale`, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE` from `@/lib/i18n/directory` (Phase 5 — re-exported there from `@/lib/api/directory`, which is where the union is declared once).
- Produces:
  - `lib/listings/view-count.ts`: `COMPACT_THRESHOLD = 9999`; `INTL_LOCALE_TAGS: Record<Locale, string>`; `formatViewCount(locale: Locale, count: number): string`; `formatExactViewCount(locale: Locale, count: number): string`.
  - `lib/i18n/listings.ts`: `LISTING_MESSAGES: Record<string, Record<Locale, string>>`; `tListing(locale: Locale, key: string, values?: Record<string, string>): string`.
  - `components/listings/ViewCount.tsx`: default export `ViewCount`, props `{ locale: Locale; count: number; className?: string }`.

**Note (ruling — `Locale` is imported, never redeclared).** Phase 5's Task 13 established that the `"en" | "it" | "es"` union is declared once, in `lib/api/directory.ts`, and re-exported from `lib/i18n/directory.ts`. Two structurally identical unions compile and are two sources of truth. This task imports the type; it does not restate it.

**Note (ruling — `Intl.NumberFormat`, not a hand-rolled formatter).** Spec §19.5 asks for a "localized integer". Italian and Spanish both group thousands with `.` and English with `,`; compact notation differs too (`10K` vs `10 mila`). `Intl` is in every supported runtime (Node 22 under Vitest, every browser Next 16 targets), needs no dependency, and is the only way to get this right without hard-coding three sets of separators — which would itself violate spec §37's "no hard-coded English UI strings" in spirit.

- [ ] **Step 1: Write the failing formatter test**

Create `frontend/src/lib/listings/view-count.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "@/lib/i18n/directory";
import {
  COMPACT_THRESHOLD,
  formatExactViewCount,
  formatViewCount,
} from "@/lib/listings/view-count";

describe("formatViewCount", () => {
  it("shows zero rather than hiding it", () => {
    // Spec 19.5: "including zero if the design calls for it" — it does: spec
    // 2.1 requires every visible state to map to a real backend value, and 0 is
    // a real value. An absent count would read as "unknown".
    expect(formatViewCount("en", 0)).toBe("0");
    expect(formatViewCount("it", 0)).toBe("0");
    expect(formatViewCount("es", 0)).toBe("0");
  });

  it("uses each locale's own thousands grouping below the threshold", () => {
    expect(formatViewCount("en", 1234)).toBe("1,234");
    expect(formatViewCount("it", 1234)).toBe("1.234");
    expect(formatViewCount("es", 1234)).toBe("1.234");
  });

  it("does not compact at exactly 9,999", () => {
    // Spec 19.5: "Use compact formatting only ABOVE 9,999."
    expect(COMPACT_THRESHOLD).toBe(9999);
    expect(formatViewCount("en", 9999)).toBe("9,999");
    expect(formatViewCount("en", 9999)).not.toMatch(/[A-Za-z]/);
  });

  it("compacts above the threshold", () => {
    expect(formatViewCount("en", 10000)).toMatch(/^10\s?K$/);
    expect(formatViewCount("en", 1500000)).toMatch(/^1\.5\s?M$/);
  });

  it("compacts in the reader's language, not in English", () => {
    const italian = formatViewCount("it", 10000);
    expect(italian).not.toBe(formatViewCount("en", 10000));
    expect(italian.length).toBeGreaterThan(0);
  });

  it("never renders a negative or fractional count", () => {
    // view_count_cached is a BigIntegerField written only by an F()+1 increment
    // and by reconciliation, so it cannot be negative — but a component must not
    // be the thing that discovers a backend bug by rendering "-3 views".
    expect(formatViewCount("en", -3)).toBe("0");
    expect(formatViewCount("en", 12.7)).toBe("12");
  });

  it("degrades a non-finite value to zero instead of rendering NaN", () => {
    expect(formatViewCount("en", Number.NaN)).toBe("0");
    expect(formatViewCount("en", Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("formatExactViewCount", () => {
  it("never compacts, whatever the size", () => {
    // Spec 19.5: "provide exact value in accessible label/title".
    expect(formatExactViewCount("en", 10000)).toBe("10,000");
    expect(formatExactViewCount("it", 1500000)).toBe("1.500.000");
    expect(formatExactViewCount("en", 1500000)).not.toMatch(/[A-Za-z]/);
  });

  it("agrees with the compact form below the threshold", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(formatExactViewCount(locale, 9999)).toBe(formatViewCount(locale, 9999));
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && pnpm vitest run src/lib/listings/view-count.test.ts`
Expected: FAIL — cannot resolve `@/lib/listings/view-count`.

- [ ] **Step 3: Write the formatter**

Create `frontend/src/lib/listings/view-count.ts`:

```ts
// Spec 19.5: "All published boat cards show eye icon + localized integer,
// including zero if the design calls for it... Use compact formatting only above
// 9,999 and provide exact value in accessible label/title."
//
// The number itself comes from `view_count` on the public listing payload, which
// is BoatListing.view_count_cached. Spec 29.1 forbids hard-coded view counts, so
// nothing here invents, rounds up or floors to a "nicer" number — the only
// transformation is presentation.
import type { Locale } from "@/lib/i18n/directory";

/** Spec 19.5's threshold. Compact formatting applies strictly ABOVE this. */
export const COMPACT_THRESHOLD = 9999;

// Intl needs BCP 47 tags; our Locale union is the API contract's short codes.
// Region-qualified tags are deliberate: "it" and "it-IT" agree today, but pinning
// the region keeps the rendering stable if a runtime's bare-language fallback
// changes.
export const INTL_LOCALE_TAGS: Record<Locale, string> = {
  en: "en-GB",
  it: "it-IT",
  es: "es-ES",
};

function normalize(count: number): number {
  // A component is not the right place to discover a backend bug by rendering
  // "-3" or "NaN". Clamp, then floor: view_count is a count of whole viewers.
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }
  return Math.floor(count);
}

/** The number as shown beside the eye icon: compact only above 9,999. */
export function formatViewCount(locale: Locale, count: number): string {
  const value = normalize(count);
  const tag = INTL_LOCALE_TAGS[locale] ?? INTL_LOCALE_TAGS.en;

  if (value > COMPACT_THRESHOLD) {
    return new Intl.NumberFormat(tag, {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat(tag).format(value);
}

/** The exact number, for the accessible label and the title attribute. */
export function formatExactViewCount(locale: Locale, count: number): string {
  const tag = INTL_LOCALE_TAGS[locale] ?? INTL_LOCALE_TAGS.en;
  return new Intl.NumberFormat(tag).format(normalize(count));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd frontend && pnpm vitest run src/lib/listings/view-count.test.ts`
Expected: PASS — 9 tests.

If `formatViewCount("en", 10000)` returns `"10K"` in your Node version and the regex `/^10\s?K$/` matches, good. If a future ICU release emits a non-breaking space, the `\s?` already covers it — do not loosen the assertion further, and never change it to `toContain("10")`, which would also pass for `"10,000"` and defeat the test.

- [ ] **Step 5: Write the failing i18n test**

Create `frontend/src/lib/i18n/listings.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "@/lib/i18n/directory";
import { LISTING_MESSAGES, tListing } from "@/lib/i18n/listings";

describe("listing messages", () => {
  it("defines every key in all three supported languages", () => {
    for (const [key, translations] of Object.entries(LISTING_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(translations[locale], `${key}.${locale}`).toBeTruthy();
      }
    }
  });

  it("defines the two keys this phase needs", () => {
    expect(LISTING_MESSAGES["listing.views.label"]).toBeDefined();
    expect(LISTING_MESSAGES["listing.views.accessible"]).toBeDefined();
  });

  it("says views, never people", () => {
    // Spec 19.2: "A household sharing an IP may count as one anonymous viewer.
    // UI copy says 'views', not 'people'." The copy must not overclaim what the
    // number measures.
    const forbidden = /pe(o|r)ple|persone|personas|visitator|visitante|viewer/i;
    for (const translations of Object.values(LISTING_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(translations[locale]).not.toMatch(forbidden);
      }
    }
  });

  it("interpolates the exact count into the accessible label", () => {
    expect(tListing("en", "listing.views.accessible", { count: "10,000" })).toContain(
      "10,000",
    );
    expect(tListing("it", "listing.views.accessible", { count: "10.000" })).toContain(
      "10.000",
    );
    expect(
      tListing("en", "listing.views.accessible", { count: "1" }),
    ).not.toContain("{count}");
  });

  it("throws on an unknown key rather than rendering an empty label", () => {
    expect(() => tListing("en", "listing.views.nope")).toThrow(/Unknown/);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd frontend && pnpm vitest run src/lib/i18n/listings.test.ts`
Expected: FAIL — cannot resolve `@/lib/i18n/listings`.

- [ ] **Step 7: Write the message dictionary**

Create `frontend/src/lib/i18n/listings.ts`:

```ts
// Spec 37: all new UI text has EN/IT/ES translation keys and no English is
// hard-coded inside components. A typed dictionary, not an i18n framework — the
// same shape and the same ruling as lib/i18n/directory.ts (Phase 5, Task 13).
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/directory";

type Translations = Record<Locale, string>;

export const LISTING_MESSAGES: Record<string, Translations> = {
  // Spec 19.2: "UI copy says 'views', not 'people'." The count is of views, and
  // a shared address counts once for a whole household — so any wording that
  // claims individuals would be a claim the data does not support.
  "listing.views.label": {
    en: "views",
    it: "visualizzazioni",
    es: "visualizaciones",
  },
  // Spec 19.5: "provide exact value in accessible label/title". {count} is the
  // exact, never-compacted number from formatExactViewCount().
  "listing.views.accessible": {
    en: "{count} views",
    it: "{count} visualizzazioni",
    es: "{count} visualizaciones",
  },
};

export function tListing(
  locale: Locale,
  key: string,
  values?: Record<string, string>,
): string {
  const translations = LISTING_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown listing message key: ${key}`);
  }
  const template = translations[locale] || translations[DEFAULT_LOCALE];
  if (!values) {
    return template;
  }
  return Object.entries(values).reduce(
    (text, [name, value]) => text.split(`{${name}}`).join(value),
    template,
  );
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `cd frontend && pnpm vitest run src/lib/i18n/listings.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 9: Write the failing component test**

Create `frontend/src/components/listings/ViewCount.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ViewCount from "@/components/listings/ViewCount";

describe("ViewCount", () => {
  it("renders zero rather than nothing", () => {
    render(<ViewCount locale="en" count={0} />);

    expect(screen.getByTestId("listing-view-count")).toHaveTextContent("0");
  });

  it("renders the compact number visibly above the threshold", () => {
    render(<ViewCount locale="en" count={12345} />);

    expect(screen.getByTestId("listing-view-count-value").textContent).toMatch(
      /^12\.3\s?K$/,
    );
  });

  it("puts the exact number in the accessible name and the title", () => {
    // Spec 19.5: "provide exact value in accessible label/title".
    render(<ViewCount locale="en" count={12345} />);
    const element = screen.getByTestId("listing-view-count");

    expect(element).toHaveAccessibleName("12,345 views");
    expect(element).toHaveAttribute("title", "12,345 views");
  });

  it("localizes both the number and the word", () => {
    render(<ViewCount locale="it" count={1234} />);
    const element = screen.getByTestId("listing-view-count");

    expect(screen.getByTestId("listing-view-count-value")).toHaveTextContent("1.234");
    expect(element).toHaveAccessibleName("1.234 visualizzazioni");
  });

  it("hides the eye icon from assistive technology", () => {
    // The icon is decoration; the accessible name already says "views".
    const { container } = render(<ViewCount locale="en" count={7} />);
    const icon = container.querySelector("svg");

    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("focusable", "false");
  });

  it("accepts an extra class without losing its own", () => {
    render(<ViewCount locale="en" count={7} className="mt-space-sm" />);

    expect(screen.getByTestId("listing-view-count").className).toContain("mt-space-sm");
  });
});
```

- [ ] **Step 10: Run it to verify it fails**

Run: `cd frontend && pnpm vitest run src/components/listings/ViewCount.test.tsx`
Expected: FAIL — cannot resolve `@/components/listings/ViewCount`.

- [ ] **Step 11: Write the component**

Create `frontend/src/components/listings/ViewCount.tsx`:

```tsx
// Spec 19.5: "All published boat cards show eye icon + localized integer,
// including zero if the design calls for it. Boat detail and owner dashboards use
// the same aggregate. Use compact formatting only above 9,999 and provide exact
// value in accessible label/title."
//
// One component for every surface that shows the number — card, detail page and
// owner dashboard — so the threshold, the icon and the accessible label cannot
// drift apart between them. Spec 29.1: "Every boat card uses one component and
// one API representation."
import type { Locale } from "@/lib/i18n/directory";
import { tListing } from "@/lib/i18n/listings";
import { formatExactViewCount, formatViewCount } from "@/lib/listings/view-count";

export default function ViewCount({
  locale,
  count,
  className = "",
}: {
  locale: Locale;
  count: number;
  className?: string;
}) {
  const display = formatViewCount(locale, count);
  const exact = tListing(locale, "listing.views.accessible", {
    count: formatExactViewCount(locale, count),
  });

  return (
    <span
      data-testid="listing-view-count"
      // One element carries both the accessible name and the hover text, so a
      // screen-reader user and a mouse user get the identical exact figure —
      // which is what "accessible label/title" asks for. The visible text stays
      // compact; aria-label replaces it for assistive technology.
      aria-label={exact}
      title={exact}
      className={`inline-flex items-center gap-space-xs font-body-sm text-on-surface-variant ${className}`.trim()}
    >
      {/* Decorative: the accessible name above already says "views". */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" />
        <circle cx="12" cy="12" r="3.25" />
      </svg>
      <span data-testid="listing-view-count-value">{display}</span>
      <span>{tListing(locale, "listing.views.label")}</span>
    </span>
  );
}
```

- [ ] **Step 12: Run the component test to verify it passes**

Run: `cd frontend && pnpm vitest run src/components/listings/ViewCount.test.tsx`
Expected: PASS — 6 tests.

If `toHaveAccessibleName` fails because the visible text is concatenated instead of replaced, confirm that `aria-label` is on the outer `<span>` and that the assertion expects the exact label — an `aria-label` on an element overrides its subtree for the accessible name, which is the behaviour this relies on.

- [ ] **Step 13: Run the whole frontend suite and lint**

Run: `cd frontend && pnpm test && pnpm lint`
Expected: PASS both. Nothing in Phase 5's directory suite should move.

- [ ] **Step 14: Commit**

```bash
git add frontend/src/lib/listings frontend/src/lib/i18n/listings.ts frontend/src/lib/i18n/listings.test.ts frontend/src/components/listings
git commit -m "feat(frontend): localized, accessible listing view-count formatter and component"
```

---

### Task 8: Phase acceptance tests, §36.2 operational rules, full regression and handoff

Spec §19's five acceptance tests, spec §40 Scenario E and spec §36.2's two "must not reset" rules, all driven end-to-end through real HTTP against the real routes — because each is a statement about what the system does, not about what a service can be made to do.

**Files:**
- Create: `backend/analytics/tests/test_phase_acceptance.py`
- Modify: `ACTIVITY.md` (append one entry to its Log)

**Interfaces:**
- Consumes: every name produced by Tasks 1–7. Produces no new production code.

- [ ] **Step 1: Write the acceptance tests**

Create `backend/analytics/tests/test_phase_acceptance.py`:

```python
"""Spec §19's Acceptance tests, spec §40 Scenario E and spec §36.2's view rules.

Each test below names the requirement it proves. Nothing here calls a service
directly: the definition of done for this phase is a statement about the API and
the database, so every view goes through GET /api/v1/listings/<id>/.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from analytics.models import ListingView
from analytics.tasks import reconcile_listing_view_counts
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus
from listings.models import BoatListing
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)

pytestmark = pytest.mark.django_db

CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0.0.0 Safari/537.36"


def _client(remote_addr="198.51.100.9", user_agent=CHROME):
    """A distinct client per simulated viewer: same address unless stated."""
    return APIClient(HTTP_USER_AGENT=user_agent, REMOTE_ADDR=remote_addr)


def _publish(listing, approver):
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = make_snapshot(listing, approved_by=approver)
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])
    return listing


@pytest.fixture
def owner():
    return make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)


@pytest.fixture
def listing(owner):
    return _publish(make_private_listing(owner=owner), owner)


def _url(listing):
    return reverse("listing-detail", kwargs={"listing_id": listing.pk})


def _count(listing):
    return BoatListing.objects.values_list("view_count_cached", flat=True).get(
        pk=listing.pk
    )


def _signed_in(user, remote_addr="198.51.100.9"):
    client = _client(remote_addr=remote_addr)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
    return client


@pytest.fixture(autouse=True)
def _no_proxies(settings):
    settings.TRUSTED_PROXY_COUNT = 0


# --- spec §19 Acceptance tests -----------------------------------------------


def test_acceptance_1_first_eligible_view_increments_from_zero_to_one(
    listing, view_counting_enabled
):
    assert _count(listing) == 0

    response = _client().get(_url(listing))

    assert response.status_code == 200
    assert _count(listing) == 1
    assert response.data["view_count"] == 1


def test_acceptance_2_repeat_views_from_the_same_identity_remain_one(
    listing, view_counting_enabled
):
    client = _client()

    for _ in range(5):
        client.get(_url(listing))

    assert _count(listing) == 1
    assert ListingView.objects.count() == 1


def test_acceptance_3_two_authenticated_users_count_as_two(
    listing, view_counting_enabled
):
    first = make_user("buyer-one@example.com", role=UserRole.BUYER)
    second = make_user("buyer-two@example.com", role=UserRole.BUYER)

    _signed_in(first).get(_url(listing))
    _signed_in(second).get(_url(listing))
    _signed_in(first).get(_url(listing))

    assert _count(listing) == 2


def test_acceptance_4_owner_staff_and_bot_do_not_count(listing, view_counting_enabled):
    moderator = make_user("mod@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    staff_admin = make_user("admin@example.com", role=UserRole.STAFF)
    staff_admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))

    _signed_in(listing.owner_user).get(_url(listing))
    _signed_in(moderator).get(_url(listing))
    _signed_in(staff_admin).get(_url(listing))
    _client(user_agent="Googlebot/2.1").get(_url(listing))
    _client(user_agent="facebookexternalhit/1.1").get(_url(listing))
    _client().head(_url(listing))
    _client().get(_url(listing), HTTP_SEC_PURPOSE="prefetch")

    assert _count(listing) == 0
    assert ListingView.objects.count() == 0


def test_acceptance_4b_a_broker_colleague_does_not_count_either(view_counting_enabled):
    """Spec §19.1's second exclusion, which the five-line acceptance list folds
    into "owner" but §19.1 states separately."""
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    colleague = make_user("colleague@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker, can_edit_listings=True)
    make_membership(colleague, broker, can_edit_listings=False)
    listing = _publish(make_broker_listing(broker=broker, actor=agent), agent)

    _signed_in(agent).get(_url(listing))
    _signed_in(colleague).get(_url(listing))

    assert _count(listing) == 0


def test_acceptance_5_concurrent_identical_requests_produce_one_row_and_one_increment(
    listing, view_counting_enabled
):
    """Spec §19's acceptance test 5, realised deterministically.

    Two real DB connections racing inside pytest-django is fragile and would end
    up proving Postgres' unique index rather than the application's handling of
    it — the same reasoning Phase 11's Task 15 recorded for spec §34.2. The
    equivalent that exercises the exact branch: a second identical request
    arrives when the first has already committed its row, which is precisely what
    the loser of a race observes. The unique index is the serialisation in both
    cases; only the interleaving is simulated.
    """
    first = _client()
    second = _client()  # same address, same user agent: one identity

    first.get(_url(listing))
    response = second.get(_url(listing))

    assert response.status_code == 200
    assert ListingView.objects.count() == 1
    assert _count(listing) == 1
    assert response.data["view_count"] == 1


# --- spec §40 Scenario E -----------------------------------------------------


def test_scenario_e_one_view_is_stored_and_insiders_add_none(
    listing, view_counting_enabled
):
    """Spec §40 Scenario E: "Given a published listing with zero views, when an
    eligible anonymous IP loads it repeatedly, then one view is stored/count
    shown; owner, staff and bot loads add none.\""""
    anonymous = _client()
    staff = make_user("staff@example.com", role=UserRole.STAFF)

    for _ in range(4):
        anonymous.get(_url(listing))
    _signed_in(listing.owner_user).get(_url(listing))
    _signed_in(staff).get(_url(listing))
    _client(user_agent="AhrefsBot/7.0").get(_url(listing))

    assert ListingView.objects.count() == 1
    assert _count(listing) == 1
    assert anonymous.get(_url(listing)).data["view_count"] == 1


# --- spec §36.2 operational rules --------------------------------------------


def test_36_2_republishing_after_expiry_does_not_reset_the_lifetime_count(
    listing, view_counting_enabled
):
    """Spec §36.2: "Republishing the same listing after expiration does not reset
    lifetime unique count." """
    _client().get(_url(listing))
    _client(remote_addr="203.0.113.5").get(_url(listing))
    assert _count(listing) == 2

    # Expire, then republish. (Phase 13 owns the real expiry task; the state
    # change is what matters here, and this test drives it directly rather than
    # inventing a service Phase 10 does not own.)
    BoatListing.objects.filter(pk=listing.pk).update(status=ListingStatus.EXPIRED)
    assert _client(remote_addr="203.0.113.6").get(_url(listing)).status_code == 404
    BoatListing.objects.filter(pk=listing.pk).update(
        status=ListingStatus.PUBLISHED, published_at=timezone.now()
    )

    assert _count(listing) == 2
    assert ListingView.objects.count() == 2
    # The original viewers are still remembered: returning does not re-count them.
    _client().get(_url(listing))
    assert _count(listing) == 2


def test_36_2_identity_is_by_listing_id_so_nothing_a_seller_edits_can_reset_it(
    listing, owner, view_counting_enabled
):
    """Spec §36.2: "Changing a listing slug does not reset views because identity
    uses listing ID." No slug field exists yet (Phase 20/21 — Phase 11's Known
    Limitation 6), so the property is proved at its root: a new approved snapshot
    replaces every piece of public content and the count is untouched."""
    _client().get(_url(listing))
    assert _count(listing) == 1

    next_snapshot = make_snapshot(
        listing, approved_by=owner, version=2, title_en="Renamed entirely"
    )
    listing.current_public_snapshot = next_snapshot
    listing.save(update_fields=["current_public_snapshot", "updated_at"])

    response = _client().get(_url(listing))
    assert response.data["snapshot_version"] == 2
    assert response.data["view_count"] == 1
    assert _count(listing) == 1


def test_a_suspended_listing_is_absent_publicly_and_records_nothing(
    listing, view_counting_enabled
):
    BoatListing.objects.filter(pk=listing.pk).update(status=ListingStatus.SUSPENDED)

    assert _client().get(_url(listing)).status_code == 404
    assert ListingView.objects.count() == 0


# --- spec §19.3 step 5 end to end --------------------------------------------


def test_reconciliation_restores_a_count_that_was_tampered_with(
    listing, view_counting_enabled
):
    _client().get(_url(listing))
    _client(remote_addr="203.0.113.5").get(_url(listing))
    BoatListing.objects.filter(pk=listing.pk).update(view_count_cached=999)

    report = reconcile_listing_view_counts()

    assert _count(listing) == 2
    assert report["corrected"] == 1


# --- spec §34.7 release-checklist line ---------------------------------------


def test_the_public_payload_carries_the_aggregate_and_nothing_else_about_viewers(
    listing, view_counting_enabled
):
    """Spec §29.1 requires "Unique view count" on the card and forbids
    "Hard-coded view counts"; spec §19.4 forbids exposing viewer identities.

    The list and detail endpoints must agree, because spec §29.1 also says
    "Every boat card uses one component and one API representation.\""""
    buyer = make_user("buyer@example.com", role=UserRole.BUYER)
    _signed_in(buyer).get(_url(listing))
    _client().get(_url(listing))

    detail = _client().get(_url(listing))
    listing_page = _client().get(reverse("listing-list"))
    card = listing_page.data["results"][0]

    assert detail.data["view_count"] == 2
    assert card["view_count"] == 2
    assert set(detail.data) == set(card)
    body = listing_page.content.decode()
    assert str(buyer.pk) not in body
    assert buyer.email not in body
```

- [ ] **Step 2: Run the acceptance tests**

Run: `cd backend && uv run pytest analytics/tests/test_phase_acceptance.py -v`
Expected: PASS — 12 tests. Every failure here is a production-code bug, not a test bug: each assertion is copied from a spec sentence quoted in its own docstring.

- [ ] **Step 3: Run the whole backend suite**

Run: `cd backend && uv run pytest -q`
Expected: PASS, with zero changes to any pre-existing test file other than `common/tests/test_throttling.py` (Task 1, additive).

- [ ] **Step 4: Verify the migration state is clean**

Run: `cd backend && uv run python manage.py makemigrations --check --dry-run`
Expected: exit 0, "No changes detected".

- [ ] **Step 5: Run the whole frontend suite, lint and build**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: PASS all three.

- [ ] **Step 6: Manual verification against a running stack**

Spec §39's execution protocol expects the phase to have been exercised, not only unit-tested. With Postgres/Redis up (`docker compose up -d`), `manage.py runserver 8020` and the flag turned on:

```bash
cd backend
uv run python manage.py shell -c "from platform_settings.services import set_feature_flag; set_feature_flag(key='unique_listing_views', is_enabled=True, actor=None)"
```

Then, against a listing you have published through the Phase 11 workflow (draft → submit → staff approve):

1. `curl -s -H 'User-Agent: Mozilla/5.0' http://127.0.0.1:8020/api/v1/listings/<id>/ | python -m json.tool | grep view_count` → `1`.
2. Repeat the identical call three times → still `1`.
3. `curl -s -H 'User-Agent: Googlebot/2.1' ...` → still `1`.
4. `curl -s -I ...` (HEAD) → still `1`.
5. Sign in as the owner and repeat with `Authorization: Bearer <access>` → still `1`.
6. Sign in as an unrelated buyer and repeat → `2`.
7. In Django admin as a **staff moderator**, confirm "Listing views" is absent from the index; as a **staff admin**, confirm it is present, read-only, and shows a masked hash.
8. `curl -s -D- -o/dev/null -H 'User-Agent: Mozilla/5.0' http://127.0.0.1:8020/api/v1/listings/<id>/ | grep -i 'cache-control\|vary'` → `Cache-Control: private, no-store` and a `Vary` containing `Authorization`. This must hold on a repeat (uncounted) request too.
9. `uv run python manage.py reconcile_listing_views` → `checked=N corrected=0 drift=0`.

Record the actual observed output in the ACTIVITY.md entry in the next step. Do not write "verified" without the numbers.

- [ ] **Step 7: Append the handoff entry to `ACTIVITY.md`**

Append one entry to `ACTIVITY.md`'s Log, in the same shape as the existing Phase 11 entry, covering: the eight tasks and their PRs; the `analytics` app and `ListingView`; the `common.ip` throttle fix; the `unique_listing_views` flag and the fact that it ships **disabled**; the `OptionalJWTAuthentication` change to `PublicListingDetailView` and its `Cache-Control: private, no-store` guard; the reconciliation task and management command; `docs/privacy/listing-view-analytics.md`; the frontend formatter/component and the fact that no card mounts it yet; and the Known Limitations list from this plan, verbatim in summary form.

The throttle fix must be called out explicitly and **described accurately**, because every other phase inherits it and because the obvious one-line summary of it is wrong. Use this wording, or wording that says the same thing:

> **Security fix inherited by every endpoint:** `common.throttling.HashedIPScopedRateThrottle` no longer uses DRF's `BaseThrottle.get_ident()`. With `NUM_PROXIES` unset — its state in this project, and DRF's default — that method's final line is `return ''.join(xff.split()) if xff else remote_addr`, i.e. it uses the **entire client-supplied `X-Forwarded-For` header** as the throttle identity. It does not select the left-most entry or any entry; there is no selection. The consequence was a **complete bypass of every rate limit in spec §30.4**: a caller sending a different arbitrary header value on each request received a brand-new, never-before-seen bucket each time. (Note that when `NUM_PROXIES` *is* configured DRF counts hops from the right, exactly as the new parser does — the defect was entirely in the unconfigured default, which trusts the client.) Identity now comes from `common.ip.canonical_client_ip()`, which uses `REMOTE_ADDR` unless `settings.TRUSTED_PROXY_COUNT` (default `0`) says how many proxies we actually operate, and falls back to `REMOTE_ADDR` directly — never to DRF's header-trusting method — when no address can be parsed. `settings.IPV6_HASH_PREFIX_BITS` (default `0`, off) is available to collapse an IPv6 prefix into one identity; see Known Limitation 13.

Do not shorten this to "fixed a left-most X-Forwarded-For spoofing bug" — that understates the severity and misdescribes the mechanism, and a future reader would draw the wrong conclusion about what DRF does.

- [ ] **Step 8: Commit**

```bash
git add backend/analytics/tests/test_phase_acceptance.py ACTIVITY.md
git commit -m "test(analytics): spec 19 acceptance suite, 40 Scenario E and 36.2 view rules"
```

---

## Known Limitations (carried forward, not fixed by this plan)

Each item names the phase that closes it. None breaks a MUST requirement *of this phase* (spec §39: "Any known limitation that breaks a MUST requirement prevents completion").

1. **Bot detection is a User-Agent policy, not verified-bot reverse DNS.** Spec §19.1 says "known verified bot"; §36.2 immediately qualifies it as "explicit detection policy" with "uncertain clients may count and are labeled operational limitation". A crawler that presents a browser User-Agent is counted, and is recorded as `HUMAN`. Forward-confirmed reverse DNS needs a DNS round-trip in the request path and a per-operator allowlist the spec configures nowhere. → **Phase 22** (spec §33, security/observability hardening), if the inflation ever proves material.
2. **No separate view-record beacon endpoint, and the detail endpoint is consequently uncacheable in a shared cache.** Spec §36.2 requires that "CDN/page caching must still call a controlled view-record endpoint or server event". There is no CDN, no page cache and no boat detail page yet, so the uncached `GET /api/v1/listings/<id>/` *is* the controlled record point. The cost of that choice is that the detail body now varies by caller identity and IP, so Task 5 marks it `Cache-Control: private, no-store` / `Vary: Authorization` — a correctness guard, not a performance decision, since a shared cache would otherwise serve one visitor's `view_count` to another. Whoever introduces edge caching must split the identity-independent content from the counted view rather than deleting that header; `analytics.recording.record_listing_view()` is a one-line mount on the beacon route when it exists. → **Phase 20/21** (Contract rule 12).
3. **`unique_listing_views` is seeded disabled.** Nothing is counted until spec §35.2 step 9 turns it on, so `view_count` is honestly `0` everywhere until then. Intentional, per §35.2 step 4. → **deployment**, not a phase.
4. **No boat card, boat detail page or owner dashboard mounts `<ViewCount>`.** Spec §19.5 says "All published boat cards show eye icon + localized integer" and "Boat detail and owner dashboards use the same aggregate"; none of those surfaces exists (`frontend/src/components/` has `auth/`, `directory/` and `layout/` only). The component and its rules are complete and tested; the surfaces are → **Phase 16** (create/edit and seller dashboard) and **Phase 20** (public cards and detail).
5. **Recording is synchronous and its failures are not swallowed.** An unexpected exception in the write path fails the public detail response rather than degrading to an uncounted-but-served page. Deliberate (see the ruling), but it is an availability trade worth revisiting with a real error budget and a durable event pipeline. → **Phase 22**.
6. **Reconciliation is eventually consistent and is not scheduled.** The task and command exist and are tested; nothing puts them on a beat. No Celery Beat schedule exists anywhere in this project yet. → whichever phase introduces periodic scheduling (**Phase 13**'s expiry task is the next consumer that needs one, spec §22.5), with §35.2 step 3 covering the deploy-time run in the meantime.
7. **A signed-in viewer is only recognised if the client sends the access token.** The public detail endpoint now parses `Authorization` (Task 5), but a Next.js server-side fetch that omits it will present as anonymous and the owner-exclusion will not fire for that request. The frontend must forward the header on boat detail fetches. → **Phase 20**, and it is called out in the Contract summary below because getting it wrong silently corrupts the metric.
8. **Anonymous identity is per-IP, so one household counts once and a mobile viewer changing networks counts twice.** Spec §19.2 accepts both explicitly ("A household sharing an IP may count as one anonymous viewer"; "do not attempt risky probabilistic identity merging"). Not a defect; stated so nobody "fixes" it with a cookie or a fingerprint. → **no phase**.
9. **`TRUSTED_PROXY_COUNT` must be set correctly at deploy time.** It defaults to `0`, which is right today (Django is reached directly) and wrong the moment a reverse proxy or CDN is put in front, at which point every anonymous viewer would collapse into the proxy's single address. → **deployment**, and it is in the Contract summary.
10. **Account erasure lowers lifetime counts.** `viewer_user` cascades, so reconciliation reduces the affected listings' numbers afterwards. Correct for a "unique viewers" metric, documented in `docs/privacy/listing-view-analytics.md`, but a seller could notice a count going down. → **no phase**; it is a product fact.
11. **No per-listing analytics for the seller beyond the total.** Spec §19.4 permits only the aggregate, and this phase ships exactly that. Views-over-time, referrers and conversion are a different product with different privacy consequences. → **no phase** as specified.
12. **`ListingView` has no `BOT` rows.** Spec §11.7's `user_agent_class` includes `BOT`, and the enum member exists, but the request path refuses a bot before any identity is resolved, so no `BOT` row is ever written. Writing bot rows would mean storing an identity for traffic the spec says must not count. The member is retained because spec §11.7 names it and a verified-bot pipeline (item 1) would populate it. → **Phase 22**, with item 1.
13. **IPv6 address-space enumeration can inflate a view count, and the mitigation ships off.** This is a counting-integrity gap, not a privacy nicety, and it is listed here because the plan's IPv6 ruling on its own frames truncation as only a privacy/accuracy trade. A typical residential or mobile IPv6 allocation is a **/64 — 2^64 addresses**, all usable for outbound traffic by one subscriber. Because `viewer_hash` is taken over the full address, one such subscriber can present a fresh, never-before-seen "unique viewer" on every request, directly defeating spec §11.7's stated purpose ("a practical uniqueness control"). No throttle catches it either: a fresh source address is also a fresh throttle bucket, so per-IP rate limiting is exactly as bypassable as the counter is. `settings.IPV6_HASH_PREFIX_BITS` (Task 1) implements the standard mitigation — collapse each /N into one identity — but ships at `0` (**off**), following the same "safe default, configure later" pattern as `TRUSTED_PROXY_COUNT`: enabling it merges every viewer behind a prefix into one, which is a real accuracy cost, and the right prefix length is a question about traffic nobody has observed yet. Contrast with IPv4, where the address space makes the same attack expensive. **Action:** set `IPV6_HASH_PREFIX_BITS=64` when the flag is enabled in production and any listing shows implausible view growth. → **deployment**, with **Phase 22** owning any stronger anti-abuse work.

---

## Contract summary for later phases

Everything a downstream phase imports from Phase 10, in one place.

```python
from analytics.enums import UserAgentClass, ViewerType
from analytics.models import ListingView
from analytics.policies import (
    BOT_USER_AGENT_MARKERS,
    PREFETCH_META_KEYS,
    ViewerIdentity,
    classify_user_agent,
    is_prefetch_request,
    resolve_viewer_identity,
    viewer_is_listing_insider,
    viewer_is_staff,
)
from analytics.recording import (
    UNIQUE_LISTING_VIEWS_FLAG,
    ViewRecordResult,
    record_listing_view,
)
from analytics.tasks import RECONCILIATION_BATCH_SIZE, reconcile_listing_view_counts
from common.authentication import OptionalJWTAuthentication
from common.ip import XFF_HEADER, canonical_client_ip, hash_client_ip
```

```ts
import ViewCount from "@/components/listings/ViewCount";
import { LISTING_MESSAGES, tListing } from "@/lib/i18n/listings";
import {
  COMPACT_THRESHOLD,
  formatExactViewCount,
  formatViewCount,
} from "@/lib/listings/view-count";
```

**Endpoints shipped by this phase: none.** No route is added, renamed or removed. `GET /api/v1/listings/<id>/` gains a side effect that spec §30.1's own table already anticipates ("public detail and counted-view integration"), and its response body is unchanged in shape — `view_count` was already there, serialized from `BoatListing.view_count_cached` by Phase 11; it simply stops always being `0`. Two response **headers** are new on that one endpoint: `Cache-Control: private, no-store` and `Vary: Authorization`, because the body is now identity-dependent (rule 12 below).

Rules a later phase must follow:

1. **`analytics.recording.record_listing_view()` is the only sanctioned writer** of `ListingView` and of `BoatListing.view_count_cached`. It holds the flag check, the eligibility decision, the uniqueness handling and the increment together. Do not insert a `ListingView` by hand, do not increment the counter anywhere else, and do not re-derive spec §19.1's exclusion list — call `analytics.policies.resolve_viewer_identity()` if you need the decision without the write.
2. **Never serialize a `ListingView` row into any response.** Spec §19.4: "Never expose viewer identities to sellers; only aggregate count." There is deliberately no serializer, no endpoint and no staff API for this table; the only human-readable surface is the staff-admin-only, read-only, hash-masked Django admin. A seller-facing analytics feature must be specified before it is built.
3. **Any surface that shows a view count uses `<ViewCount>`** — the boat card (Phase 20), the boat detail page (Phase 20) and the owner dashboard (Phase 16). Spec §19.5 requires them to "use the same aggregate", and spec §29.1 requires one component. Do not re-implement the 9,999 threshold or the accessible label; import them.
4. **A frontend fetch of boat detail MUST forward the viewer's `Authorization` header** when the viewer is signed in. Without it the request presents as anonymous, the owner/staff/broker exclusions cannot fire, and a seller silently counts their own visits. This is Known Limitation 7 and it is the single easiest way for Phase 20 to corrupt this metric.
5. **`TRUSTED_PROXY_COUNT` must be raised to match the real topology** the moment a reverse proxy or CDN is placed in front of Django (spec §11.7: "Proxy headers are trusted only from configured reverse proxies"). Leaving it at `0` behind a proxy collapses every anonymous viewer into the proxy's address — one lifetime view per listing, forever. Setting it *higher* than the real hop count is worse: it starts trusting client-written entries again.
6. **Use `common.ip.hash_client_ip()` for any future IP-derived identifier**, never a fresh `hmac.new(...)`. One secret, one rotation. `CONTACT_HASH_SECRET` is already shared by the throttle and `viewer_hash`; spec §11.8's contact-access work is the next likely consumer.
7. **Phase 12** (broker auto-approval) and **Phase 13** (expiry) change a listing's `status` through `listings.decisions` / their own services. Neither needs to touch view counting: spec §36.2 requires that expiry-then-republication does **not** reset the count, and it does not, because `ListingView` rows key on the listing ID and are never deleted on a status change. Do not add a "reset views" step to any lifecycle transition.
8. **Phase 13's expiry task and this phase's reconciliation task both want a schedule.** Whichever lands Celery Beat first should register `analytics.tasks.reconcile_listing_view_counts` alongside its own (suggested: daily, off-peak, on the existing `maintenance` queue).
9. **Phase 20/21's boat detail page and sitemap** must not fetch `GET /api/v1/listings/<id>/` speculatively on behalf of a user who is not looking at that listing — a prefetch that omits the standard prefetch headers is indistinguishable from a view. If a build-time or revalidation fetch is needed, send `Sec-Purpose: prefetch`, which `analytics.policies.is_prefetch_request()` already honours.
10. **Adding a bot marker to `BOT_USER_AGENT_MARKERS` is a normal code change; removing one is not.** Every entry is a decision that some traffic does not count. Removals retroactively change nothing (rows already exist or do not), but they change the metric's meaning going forward — say so in the PR.
11. **`OptionalJWTAuthentication` grants nothing.** It populates `request.user` when a credential is valid and stays silent otherwise. Any endpoint using it still needs its own `permission_classes`; do not read it as "authentication optional, therefore access optional".
12. **`GET /api/v1/listings/<id>/` is no longer safe to cache in a shared cache, and its `Cache-Control: private, no-store` header must not be removed or weakened.** Before this phase the detail body was identical for every caller; it now varies by `Authorization` (insiders are excluded and see the unincremented number) and by client IP (a first-time viewer sees N+1, a returning one N). A CDN, reverse proxy or Next.js data cache that stores one response and replays it therefore leaks one visitor's personalised `view_count` to others and — worse — serves a body whose number nobody's own request produced. If Phase 20/21 wants this endpoint cached at the edge, the correct move is spec §36.2's separate "controlled view-record endpoint": split the cacheable, identity-independent listing content from the counted view, rather than dropping the header. `PublicListingListView` is unaffected and stays cacheable.

---

## Self-Review

**1. Spec coverage — §19 (Phase 10), line by line:**

| Spec §19 requirement | Where implemented |
|---|---|
| §19.1 "only on a successful human GET of a published boat detail page/API detail view" | Task 3 (`resolve_viewer_identity`: method + published checks), Task 5 (the hook is on `retrieve()`) |
| §19.1 "Search-result card impressions do not count" | Task 5 (`PublicListingListView` deliberately unchanged) + its test `test_the_list_endpoint_never_counts`, Task 8 |
| §19.1 excluded: viewer is the private listing owner | Task 3 (`viewer_is_listing_insider`), Tasks 5, 8 |
| §19.1 excluded: viewer belongs to the owning broker organization | Task 3 (`viewer_is_listing_insider`, `BrokerMembership` query), Tasks 5, 8 |
| §19.1 excluded: viewer is staff | Task 3 (`viewer_is_staff`), Tasks 5, 8 |
| §19.1 excluded: HEAD | Task 3 (`request.method != "GET"`), Tasks 5, 8 |
| §19.1 excluded: prefetch/prerender | Task 3 (`is_prefetch_request`, `PREFETCH_META_KEYS`), Tasks 5, 8 |
| §19.1 excluded: health check | Task 3 — ruled: a different URL, plus monitoring-agent markers in `BOT_USER_AGENT_MARKERS` |
| §19.1 excluded: known verified bot | Task 3 (`classify_user_agent`, `BOT_USER_AGENT_MARKERS`); verified-bot DNS is Known Limitation 1 |
| §19.1 excluded: listing is not published | Task 3 (status + `current_public_snapshot` pair), Task 8 (`test_a_suspended_listing_is_absent_publicly...`) |
| §19.2 authenticated eligible viewer → `viewer_user` | Task 3 (`ViewerIdentity`), Task 2 (column + constraints) |
| §19.2 anonymous eligible viewer → HMAC hash of canonical client IP | Task 1 (`canonical_client_ip`, `hash_client_ip`), Task 3 |
| §19.2 anonymous-then-logged-in counts separately, no merging | Task 3 (explicit comment + no lookup), Task 4 (`test_the_same_person_anonymously_then_signed_in...`) |
| §19.2 household on one IP counts as one; copy says "views" not "people" | Task 4 (`test_a_second_browser_on_the_same_address...`), Task 7 (`listings.test.ts` forbidden-wording test) |
| §19.3.1 resolve viewer identity | Task 3 |
| §19.3.2 `INSERT ... ON CONFLICT DO UPDATE last_seen_at` or equivalent | Task 4 (`_insert_or_touch`, ruled equivalence; the `except IntegrityError` branch re-raises when the fallback UPDATE matches zero rows, so only a genuine uniqueness conflict is absorbed — `test_a_non_uniqueness_integrity_error_propagates_instead_of_being_swallowed`) |
| §19.3.3 increment only when a new unique row is inserted | Task 4 (`_increment` guarded by `inserted`) |
| §19.3.4 short transaction; do not delay rendering if an async durable pipeline exists | Task 4 (one `atomic()` around two statements; ruled — no such pipeline exists) |
| §19.3.5 reconciliation task recomputing cached counts from rows | Task 6 (`reconcile_listing_view_counts` + management command) |
| §19.3 "must not increment on refresh, repeated API fetch, or a second browser on the same anonymous IP" | Task 4 (three dedicated tests), Task 8 acceptance 2 |
| §19.4 never expose viewer identities to sellers; aggregate only | Task 2 (no serializer exists), Task 5 (`test_no_viewer_identity_appears_anywhere...`), Contract rule 2 |
| §19.4 raw IP not in the analytics table | Task 1/Task 2 (only `viewer_hash` is stored; model docstring), Task 2 hash-format constraint |
| §19.4 delete view identity rows when the listing is permanently deleted | Task 2 (`listing` CASCADE + test) |
| §19.4 otherwise retain for lifetime uniqueness, and document purpose/retention | Task 6 (`docs/privacy/listing-view-analytics.md`), Task 2 model docstring |
| §19.4 restrict row-level analytics to authorized staff/engineering | Task 2 (`ListingViewAdmin`: read-only, `is_staff_admin` only, masked hash) |
| §19.5 every published boat card shows eye icon + localized integer, including zero | Task 7 (`<ViewCount>`, zero test); mounting is Phase 20 (Known Limitation 4) |
| §19.5 boat detail and owner dashboards use the same aggregate | Task 7 (one component, one source: `view_count`); surfaces are Phases 16/20 |
| §19.5 compact formatting only above 9,999 | Task 7 (`COMPACT_THRESHOLD`, boundary tests at 9,999 and 10,000) |
| §19.5 exact value in accessible label/title | Task 7 (`formatExactViewCount`, `aria-label` + `title` tests) |
| §19 Acceptance 1 — first eligible view increments 0 → 1 | Task 8 |
| §19 Acceptance 2 — repeat views from the same identity remain 1 | Task 8 |
| §19 Acceptance 3 — two authenticated users count as 2 | Task 8 |
| §19 Acceptance 4 — owner/staff/bot do not count | Task 8 (plus 4b for the broker colleague) |
| §19 Acceptance 5 — concurrent identical requests → one row, one increment | Task 8 (deterministic realisation, ruled and explained) |

**2. Spec coverage — cross-referenced sections:** §11.7's `ListingView` (all eight listed fields and all three listed constraints, plus three additional integrity constraints that are refinements, not additions: viewer-type/identity agreement, lowercase-hex hash format, `last_seen_at >= first_viewed_at`) → Task 2; §11.7's hash formula and "proxy headers are trusted only from configured reverse proxies" → Task 1. §29.1's "Unique view count" required card field and its "Hard-coded view counts" prohibition → Task 7 + Task 8's payload test. §30.1's `GET /api/v1/listings/<id>/` "public detail and counted-view integration" → Task 5; no endpoint added or renamed. §30.2's envelope and "mutations return updated resource/version" → untouched; this phase adds no error code and no mutation endpoint. §30.4's enumerated rate-limited paths → unchanged (no new scope); its "Rate limiting must not store raw IP" → Task 1 keeps the existing compliance and additionally **closes a complete rate-limit bypass**, since DRF's unconfigured `get_ident()` keyed every bucket on the entire client-supplied `X-Forwarded-For` header (Task 1's `test_rotating_the_forwarded_header_cannot_mint_endless_fresh_buckets`). §36.2's "CDN/page caching" sentence → Task 5 additionally sets `Cache-Control: private, no-store` and `Vary: Authorization` on the detail response, because after this phase that body varies by caller identity and IP and a shared cache would otherwise replay one visitor's `view_count` to another (`test_the_detail_response_is_never_cacheable_by_a_shared_cache`). §34.7's checklist line "View counts are unique under the defined identity rule and owner/staff/bot excluded" → Task 8's acceptance 2, 4, 4b and 5. §35.1's `unique_listing_views` → Task 4's seed migration and flag check; §35.2 step 9 → the same flag, shipped off. §36.2's four view rules → Task 8 (republication, identity-by-ID), Known Limitation 2 (CDN beacon), Task 3 + Known Limitation 1 (bot policy, uncertain clients labelled `UNKNOWN` and counted). §37's EN/IT/ES keys → Task 7. §39's "no partial implementations, no TODO placeholders for backend enforcement" → every exclusion is enforced in code and tested; the two things not built (verified-bot DNS, the beacon endpoint) are ruled and assigned, not stubbed. §40 Scenario E → Task 8.

**Gaps deliberately left, with the owning phase named:** §19.5's actual card/detail/dashboard surfaces (Phases 16 and 20 — no boat card exists, and inventing one is forbidden by §2.1); §36.2's CDN beacon endpoint (Phase 20/21, when a cache exists to need it); verified-bot reverse DNS (Phase 22); a Celery Beat schedule for the reconciliation task (whichever phase introduces Beat — Phase 13 is the next consumer). Everything else in §19 is accounted for above.

**3. Placeholder scan:** no task contains "TBD", "TODO", "implement later", "add appropriate error handling", "handle edge cases", "similar to Task N", or a test described but not written. Every code step carries the real code and every test step carries the real test body. Two steps deliberately instruct the implementer to *verify a fact before coding* rather than to invent one — Task 4 Step 5 (confirm the real `platform_settings` migration name that creates `FeatureFlag` before depending on it) and Task 5 Step 1's note (confirm what SimpleJWT 5.5's `get_user` raises for an unusable payload, with the fallback assertion spelled out in full). Those are not placeholders: both name the exact command to run, the exact thing to look for and the exact alternative to write. `analytics.enums.UserAgentClass.BOT` is an enum member with no writer in this phase; it is retained because spec §11.7 names it, and that is recorded as Known Limitation 12 rather than left as a silent dead value.

**4. Type and name consistency (checked across every task's Interfaces block):**
- `canonical_client_ip(request) -> str | None` and `hash_client_ip(value: str) -> str` — defined in Task 1, imported unchanged by Task 1's own throttle rewrite and by Task 3's `resolve_viewer_identity`; the test helpers in Tasks 3, 4 and 5 assert against `hash_client_ip("198.51.100.9")` with that exact spelling.
- `XFF_HEADER` — defined in Task 1, used by Task 1's tests only; no other module hard-codes `"HTTP_X_FORWARDED_FOR"`.
- `settings.TRUSTED_PROXY_COUNT` and `settings.IPV6_HASH_PREFIX_BITS` — both read only inside `common/ip.py`, both via `getattr(settings, ..., 0) or 0` so an absent setting is valid, both defaulting to `0` = "change nothing", both declared in `base.py` and `.env.example` in Task 1 Step 4. Spelled identically in the settings block, the env example, `common/ip.py`, the test `settings` fixtures and Known Limitation 13.
- `ViewerType.USER` / `ViewerType.ANONYMOUS` and `UserAgentClass.HUMAN` / `.BOT` / `.UNKNOWN` — defined once in Task 2, identical in Tasks 2, 3, 4, 5 and the factories.
- `ListingView` field names — `listing`, `viewer_type`, `viewer_user`, `viewer_hash`, `first_viewed_at`, `last_seen_at`, `user_agent_class` — identical in Task 2's model, Task 2's factories, Task 4's `_insert_or_touch` `create()` call, Task 6's `Count("views")` (the `related_name`) and every test. **Neither timestamp auto-generates**, and every construction site — `make_user_view`, `make_anonymous_view`, `_insert_or_touch`, and the four inline `ListingView.objects.create(...)` calls in Tasks 2 and 4 — passes one captured `now` to *both* `first_viewed_at` and `last_seen_at`. This was checked call by call: an `auto_now_add` on `first_viewed_at` plus a pre-captured `last_seen_at` violates the `analytics_view_last_seen_not_before_first_viewed` CHECK on every first insert, and `_insert_or_touch` would then mask it as a uniqueness race.
- `ViewerIdentity(viewer_type, viewer_user, viewer_hash, user_agent_class)` with `.lookup()` — defined in Task 3; constructed only there; consumed in Task 4 by exactly those four attribute names plus `lookup()`, which returns the key the `filter()` in `_insert_or_touch` uses.
- `record_listing_view(*, listing, request) -> ViewRecordResult` — one signature, in Task 4's definition, Task 4's tests, Task 5's view hook and the Contract summary. `ViewRecordResult.counted` is the only attribute Task 5 reads.
- `UNIQUE_LISTING_VIEWS_FLAG = "unique_listing_views"` — defined in Task 4's `recording.py`, imported by Task 4's `conftest.py`, and the same literal string appears in Task 4's seed migration (which cannot import it: migrations must not depend on live code) and in Task 8's manual-verification shell command. Those four spellings are identical.
- `reconcile_listing_view_counts(*, batch_size, listing_ids)` returning `{"checked", "corrected", "drift"}` — one signature and one key set, in Task 6's definition, its tests, the management command's `format(**report)` and Task 8's end-to-end test.
- `OptionalJWTAuthentication` — defined in Task 5's `common/authentication.py`, used in exactly one place (`PublicListingDetailView.authentication_classes`).
- Route names — `listing-detail` and `listing-list` — are Phase 11's, unchanged, and every `reverse()` in Tasks 5 and 8 uses them with the `listing_id` kwarg Phase 11's `urls.py` declares.
- Frontend: `Locale` is imported from `@/lib/i18n/directory` in all three new files and redeclared in none. `formatViewCount` / `formatExactViewCount` / `COMPACT_THRESHOLD` / `tListing` / `LISTING_MESSAGES` are spelled identically in their definitions, their tests and `ViewCount.tsx`. The two message keys `listing.views.label` and `listing.views.accessible` appear in the dictionary, the i18n test and the component with no third spelling.
- Test data attributes — `listing-view-count` and `listing-view-count-value` — appear only in `ViewCount.tsx` and `ViewCount.test.tsx`, identically.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-18-phase-10-listing-analytics.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, reviewed between tasks, fast iteration. This matches the project's established per-task-branch/per-task-PR convention recorded in `ACTIVITY.md`.

**2. Inline Execution** — execute tasks in one session using `superpowers:executing-plans`, batching with checkpoints for review.

Recommended order of attention for the reviewer before execution starts: the Task 1 throttle change (it touches every endpoint in the project, and closes a complete rate-limit bypass rather than a partial spoofing risk — read the quoted DRF source in the rulings section, not a summary of it); the Task 2 timestamp ruling (`first_viewed_at` must **not** be `auto_now_add`, or every first insert violates a CHECK constraint and `_insert_or_touch` silently absorbs the failure); the Task 4 `except IntegrityError` branch (it re-raises when the fallback UPDATE matches zero rows, which is what keeps "recording failures are not swallowed" true); the Task 5 authentication change and its `Cache-Control` guard (they touch the public read path Phase 11 hardened); and the privacy rulings in "Phase boundaries and rulings" — particularly the `viewer_user` CASCADE decision, which makes lifetime counts able to decrease.

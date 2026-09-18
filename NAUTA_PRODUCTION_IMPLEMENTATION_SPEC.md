# NAUTA Marketplace — Production Implementation Specification

**Document status:** Approved implementation baseline  
**Version:** 1.0  
**Date:** 17 September 2026  
**Audience:** Product, UX/UI, frontend, Django/backend, QA, DevOps and operations teams  
**Normative language:** “MUST”, “MUST NOT”, “SHOULD” and “MAY” are binding in the sense defined in this document.

---

## 0. Purpose and authority of this document

This document converts the approved NAUTA prototype and the post-presentation change requests into an implementation-ready production specification. It is intentionally self-contained. A developer must be able to implement the project without asking what a field, status, permission, validation, endpoint, notification or acceptance condition means.

When this document conflicts with the earlier 51-screen static prototype specification, this document takes precedence for the subjects it changes. Earlier rules that are not changed here remain valid, especially:

- NAUTA is a yacht and boat marketplace, not a bank, lender, escrow provider, registry or government authority.
- Supported interface languages are exactly English (`en`), Italian (`it`) and Spanish (`es`).
- Semantic yacht search and optional user-triggered AI translation remain allowed.
- Escrow, fund custody, bank integration claims, MLS/syndication, AI price valuation and automated social-media production remain outside scope.
- Payment in this specification is limited to purchasing NAUTA listing/media entitlements through Stripe. NAUTA does not process the sale price of a boat.

The former requirement of “exactly 51 screens” is no longer a production requirement. Two duplicate public directory screens are deliberately merged, and one obsolete broker screen is replaced by messaging. No artificial screen may be added merely to preserve a historical count.

---

## 1. Product decisions fixed by this specification

The following decisions are final unless a later signed change request explicitly overrides them.

| Topic | Final decision |
|---|---|
| Combined directory name | Visible navigation label: **Services / Professionals**. H1: **Nautical Services & Professionals**. |
| Canonical combined URL | `/services/professionals/` |
| Retired directory URLs | `/services/` and `/professionals/` return permanent 301 redirects to `/services/professionals/`. |
| Service SEO pages | The six approved individual service pages remain indexable and keep their own canonical URLs. |
| Professional profile URL | `/services/professionals/<professional-slug>/` |
| Standard inquiry form | One shared component and one backend serializer/service are used for boat, broker and professional inquiries. |
| Inquiry authentication | A verified-email user account is required to submit. Guests can fill the form, but submission opens authentication and preserves the draft and return URL. |
| Contact reveal | Broker/professional contact details are blurred until the current user has successfully sent a valid platform inquiry to that entity. Reveal is scoped to that user and entity, is audited, and never makes contact data public. |
| Finance calculation | Standard fixed-rate, fully amortizing monthly-payment estimate. It is an illustration, not a credit offer or approval. |
| Global finance defaults | Annual nominal interest rate `5.00%`, term `48` months, down payment `20.00%`. All are editable by authorized staff in Django. |
| Finance card eligibility | Only broker-owned listings can show finance information, and only when the broker enables the listing-level toggle. |
| Private-seller finance | Never displayed; no finance toggle is shown or accepted for private-seller listings. |
| View uniqueness | One counted view per listing and viewer identity for the life of the listing. Authenticated viewers use user ID; guests use a keyed hash of normalized IP. |
| Broker listing quota | Unlimited. Approval policy is controlled per broker with `auto_approve_listings`. |
| Individual free allowance | One free listing per rolling 365-day entitlement period; published for 30 days. Both numbers are staff-configurable. |
| Paid listing right | One-time Stripe purchase creates one single-use listing entitlement. Default publication duration is 30 days; unused entitlement expires after 365 days. |
| Individual media allowance | Base entitlement: exactly 1 image and 0 videos. A listing-specific media upgrade raises the total to 20 images and 1 video. |
| Broker media allowance | Maximum 20 images and 1 video per listing; no media-upgrade purchase is required. |
| Video limit | One MP4/WebM video, maximum 120 seconds and 250 MiB after validation. |
| Immutable individual fields | Brand, model selection/custom model text and manufacture year lock after first publication approval. |
| Individual edits | Editable fields create a revision. The last approved version remains public while a later revision is pending. |
| Brand/model source | Database only; searchable dependent dropdowns. `Other` applies to model, not brand. |
| Other-model publication | Allowed with required custom model text; creates staff in-app/WebSocket/email notification. |
| Broker dashboard cleanup | Remove Services & Surveyors. Replace it with Messages using the private-seller message pattern. |
| Notification timing | Queue WebSocket and email work only after the database transaction commits successfully. |
| Stripe fulfillment | Entitlements are granted only from a verified, idempotently processed Stripe webhook, never from the browser success redirect. |

---

## 2. Non-negotiable implementation principles

### 2.1 Every visible state requires a backend source

Production UI must not display invented, hard-coded or randomly generated operational data. Every dynamic component must map to a database field, computed domain service, API response or explicit feature/configuration setting.

Examples:

- Monthly installment → server-side `FinanceQuoteService` result and calculation-version metadata.
- View count → aggregated accepted `ListingView` records.
- “Pending approval” badge → listing or revision workflow state.
- Remaining listing rights → entitlement ledger, not a frontend counter.
- Contact blur/unlock → authorization response from `ContactAccessService`.
- Broker auto-approval switch → persisted `BrokerProfile.auto_approve_listings` changed by staff and audited.
- Notification badge → unread `Notification` rows.
- “Other — McKenzie” → persisted `custom_model_name`, not concatenated demo text.

Skeleton loaders and explicitly marked empty/demo placeholders are permitted only during loading or in non-production seed environments.

### 2.2 Server authority

Frontend hiding, disabled buttons and client-side validation improve usability but never enforce business rules. The backend must independently reject unauthorized, over-quota, invalid-state and payment-dependent actions.

### 2.3 Atomic state changes

Any operation affecting an entitlement, payment fulfillment, listing publication, revision approval or view uniqueness must use database constraints and `transaction.atomic()`. Rows representing scarce rights must be locked with `select_for_update()` before consumption. Notifications are scheduled through `transaction.on_commit()`.

### 2.4 Auditability

Staff actions, permission-sensitive status transitions, contact reveals, entitlement grants/consumption/refunds, listing approvals/rejections and taxonomy mappings must generate immutable audit events containing actor, action, target, before/after summary, timestamp, request ID and source.

### 2.5 No misleading finance language

The finance feature is an estimator. It must not use “approved”, “pre-approved”, “guaranteed”, “offer”, “your rate” or a named lender unless a future regulated integration is separately approved. All results must display: “Illustrative estimate only. Not a credit offer. Taxes, fees and lender conditions are not included.”

---

## 3. Recommended production architecture

If the existing repository already uses compatible versions, do not perform an unrelated framework upgrade inside this feature. Otherwise use this baseline:

- Python 3.12+
- Django 5.2 LTS
- Django REST Framework for JSON APIs
- PostgreSQL 16+
- Redis for cache, Celery broker and Channels layer
- Celery for email, media processing and retryable background work
- Django Channels for authenticated WebSocket notifications
- Stripe Checkout for one-time entitlement purchases
- S3-compatible object storage with private upload staging and processed public media
- CDN for approved listing images/video
- Structured JSON logging, error tracking and metrics

Suggested Django apps:

```text
accounts
brokers
professionals
services_catalog
listings
taxonomy
messaging
financing
entitlements
payments
moderation
notifications
analytics
audit
platform_settings
```

No business rule should live only in a view, template, serializer or JavaScript handler. Place reusable rules in domain services/selectors and call the same code from HTML views, APIs, staff actions and tasks.

---

## 4. Canonical route and screen map

### 4.1 Public routes

| Route | Purpose | Backend source |
|---|---|---|
| `/` | Homepage | featured listings, guides, ads, global settings |
| `/boats/` | Search/list results | published listing query service |
| `/boats/<listing-slug>/` | Boat detail | approved public snapshot |
| `/boats/compare/` | Comparison | listing IDs and public snapshots |
| `/brokers/` | Broker directory | active public broker profiles |
| `/brokers/<broker-slug>/` | Broker profile | broker profile, public listings, inquiry context |
| `/services/professionals/` | Combined service/professional directory | categories, providers and approved service content |
| `/services/professionals/<professional-slug>/` | Professional detail | streamlined professional profile and inquiry context |
| `/services/full-brokerage/` | Approved SEO service detail | CMS/service catalog |
| `/services/legal/` | Approved SEO service detail | CMS/service catalog |
| `/services/insurance/` | Approved SEO service detail | CMS/service catalog |
| `/services/engines-maintenance/` | Approved SEO service detail | CMS/service catalog |
| `/services/transport-delivery/` | Approved SEO service detail | CMS/service catalog |
| `/services/nautical-marketing/` | Approved SEO service detail | CMS/service catalog |
| `/sell/` | Sell landing | policies and CTA eligibility summary |
| `/sell/create/` | Role-aware listing creation | eligibility, taxonomy, entitlement and listing services |
| `/financing/` | Finance estimator | global finance configuration and quote endpoint |
| `/guides/` | Guides index | CMS |
| `/guides/<article-slug>/` | Article detail | CMS |
| `/contact/` | NAUTA contact | support/contact service |
| `/login/` | Authentication | accounts |

### 4.2 Private routes

| Role | Routes |
|---|---|
| Private seller | `/dashboard/private-seller/`, `/listings/`, `/messages/`, `/account/`, `/services/` |
| Broker | `/dashboard/broker/`, `/fleet/`, `/leads/`, `/messages/`, `/team/`, `/profile/`, `/subscription/` |
| Service provider | `/dashboard/service-provider/`, `/requests/`, `/requests/<id>/`, `/profile/`, `/services/` |
| Staff | `/dashboard/staff/`, `/boats/`, `/users/`, `/brokers/`, `/providers/`, `/leads/`, `/service-requests/`, `/subscriptions/`, `/products/`, `/taxonomy/`, `/advertising/`, `/content/`, `/reports/`, `/settings/` |

The obsolete broker route `/dashboard/broker/services/` returns 301 to `/dashboard/broker/messages/` after deployment. It must not remain in navigation.

### 4.3 Legacy redirects

| Old route | New canonical route | Status |
|---|---|---:|
| `/services/` | `/services/professionals/` | 301 |
| `/professionals/` | `/services/professionals/` | 301 |
| `/professionals/profile/?id=<legacy>` | resolved professional slug URL | 301 when resolvable, otherwise 404 |
| `/brokers/profile/?id=<legacy>` | resolved broker slug URL | 301 when resolvable, otherwise 404 |
| `/dashboard/broker/services/` | `/dashboard/broker/messages/` | 301 |

Redirect destinations must be covered by automated tests, preserve safe query parameters where needed and never create redirect chains.

---

## 5. Roles and permissions

Roles are additive Django permissions/groups, but each marketplace account has one primary marketplace role.

| Capability | Guest | Authenticated buyer/user | Private seller | Broker member | Broker admin | Professional | Staff moderator | Staff admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Browse public content | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Submit inquiry | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reveal recipient contact after inquiry | — | own access | own access | own access | own access | own access | ✓ | ✓ |
| Create private listing | — | — | ✓ | — | — | — | — | ✓ on behalf |
| Create broker listing | — | — | — | with permission | ✓ | — | — | ✓ on behalf |
| Enable listing finance flag | — | — | — | with edit permission | ✓ | — | — | override |
| Approve listings/revisions | — | — | — | — | — | — | ✓ | ✓ |
| Configure broker auto-approval | — | — | — | — | — | — | — | ✓ |
| Configure products/settings | — | — | — | — | — | — | — | ✓ |
| Manage taxonomy | — | — | — | — | — | — | — | ✓ |

Staff viewing a listing must not increment public view counts. Listing owners and members of the owning broker organization must not increment their own listing counts.

---

## 6. End-to-end state models

### 6.1 Listing state

```text
DRAFT
  -> PENDING_APPROVAL
  -> PUBLISHED
  -> EXPIRED
  -> ARCHIVED

PENDING_APPROVAL -> REJECTED -> DRAFT
PUBLISHED -> SUSPENDED -> PUBLISHED or ARCHIVED
PUBLISHED -> EXPIRED
```

Rules:

- A private-seller initial publication always enters `PENDING_APPROVAL`.
- A broker initial publication enters `PUBLISHED` only if its broker has `auto_approve_listings=true`; otherwise it enters `PENDING_APPROVAL`.
- `PUBLISHED` requires an approved public snapshot, active publication window, valid owner status, valid entitlement where applicable and required media/content.
- Suspension is staff-only and requires a reason.
- Expiration is automatic through a scheduled task and is idempotent.

### 6.2 Revision state

```text
DRAFT -> SUBMITTED -> APPROVED
                   -> CHANGES_REQUESTED -> DRAFT
                   -> REJECTED
SUBMITTED -> WITHDRAWN (owner before staff decision)
```

Private-seller edits to an already published listing never mutate the public snapshot. The current public snapshot remains visible until a submitted revision is approved. Approval atomically copies permitted revision fields into a new public snapshot and records a version number.

### 6.3 Entitlement state

```text
AVAILABLE -> RESERVED -> CONSUMED
AVAILABLE -> EXPIRED
RESERVED -> AVAILABLE (creation cancelled or timed out)
CONSUMED -> REVOKED (refund/chargeback or staff remedy)
```

Reservations expire after 30 minutes unless attached to a saved draft. Consumption happens when the listing is submitted for initial approval, not when the create form first opens.

### 6.4 Payment state

```text
CREATED -> CHECKOUT_OPEN -> PAID -> FULFILLED
                         -> FAILED
                         -> EXPIRED
PAID/FULFILLED -> REFUNDED or DISPUTED
```

`PAID` means Stripe has confirmed payment. `FULFILLED` means an entitlement was created exactly once. Repeated webhook delivery must return success without creating a second entitlement.

---

## 7. Delivery phases and dependency order

Implementation must proceed in the following order. A phase is not complete until its migrations, backend rules, frontend state, permissions and tests pass.

| Phase | Name | Depends on | Primary result |
|---:|---|---|---|
| 0 | Repository audit and scope freeze | — | Known baseline and migration plan |
| 1 | Infrastructure and environments | 0 | PostgreSQL/Redis/Celery/Channels/storage/Stripe wiring |
| 2 | Shared domain types and platform settings | 1 | Enums, settings, feature flags, audit base |
| 3 | Identity, organizations and permissions | 2 | Enforced roles and ownership |
| 4 | Brand/model taxonomy | 3 | Database-backed searchable selection and Other flow |
| 5 | Directory consolidation | 3, 4 | One Services / Professionals directory and redirects |
| 6 | Shared inquiry and messaging core | 3, 5 | One form, one conversation model, email field |
| 7 | Contact privacy and reveal access | 6 | Blurred/unlocked contact policy |
| 8 | Finance configuration and calculation engine | 2 | Versioned server calculation |
| 9 | Finance UI and broker listing flag | 4, 8 | Card estimate, new-tab calculator, broker-only toggle |
| 10 | Listing view analytics | 3, 4 | Unique lifetime views and card count |
| 11 | Listing workflow and immutable snapshots | 3, 4 | Approval/revision state machine |
| 12 | Broker policy and auto-approval | 11 | Unlimited listings, per-broker approval policy |
| 13 | Individual quota and entitlement ledger | 11 | Free/paid right enforcement |
| 14 | Stripe product and fulfillment | 13 | Safe one-time purchases |
| 15 | Media policy and processing | 13, 14 | Role/right-specific upload limits |
| 16 | Role-aware create/edit experience | 9, 11–15 | Complete listing form behavior |
| 17 | Staff products, moderation and taxonomy UI | 12–16 | Operational back office |
| 18 | WebSocket, email and in-app notifications | 6, 11–17 | Reliable staff/user alerts |
| 19 | Broker dashboard simplification and messages | 6, 12 | Obsolete screen removed, messaging added |
| 20 | Public card/profile integration and responsive QA | 5–10 | Final production UI |
| 21 | Data migration, redirects and SEO | 5, 11, 20 | Safe cutover and canonical indexing |
| 22 | Security, privacy, performance and observability | all features | Production hardening |
| 23 | Automated QA and UAT | all prior | Release evidence |
| 24 | Deployment, rollback and post-launch verification | 23 | Controlled release |

---

## 8. Phase 0 — Repository audit and scope freeze

### Work

1. Inventory current routes, templates/components, Django apps, models, migrations, JavaScript bundles and static prototype remnants.
2. Map every visible dynamic value to an existing backend field or mark it for implementation using the traceability matrix in this document.
3. Identify duplicate Services and Professionals data and choose a single canonical record for each provider/category.
4. Export production-like database schema and anonymized counts, not personal data.
5. Record current Stripe mode, webhook endpoints, storage provider, email provider, Redis/Channels status and deployment topology.
6. Add architecture decision records for directory merge, listing snapshots, entitlement ledger, view identity and contact reveal.
7. Freeze unrelated UI redesign. Preserve established NAUTA design tokens and visual hierarchy.

### Definition of done

- Route inventory and data migration mapping are committed.
- No unresolved duplicate model ownership remains.
- Feature flags and rollback boundaries are identified.
- Existing tests run successfully before changes.

---

## 9. Phase 1 — Infrastructure and environments

### Required environments

- Local development
- Automated test/CI
- Staging with Stripe test mode and non-production email sink
- Production with Stripe live mode and real email provider

### Environment variables

```text
DATABASE_URL
REDIS_URL
DJANGO_SECRET_KEY
DJANGO_ALLOWED_HOSTS
DJANGO_CSRF_TRUSTED_ORIGINS
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
EMAIL_BACKEND / provider credentials
DEFAULT_FROM_EMAIL
OBJECT_STORAGE_* credentials
CONTACT_HASH_SECRET
PUBLIC_BASE_URL
```

Secrets must never appear in templates, logs, repository files or staff-editable settings. Stripe test/live identifiers must never be mixed.

### Background queues

Use separate Celery queues:

- `default`: ordinary async tasks
- `notifications`: email and in-app fan-out
- `media`: image/video validation and processing
- `maintenance`: expiration, aggregation and cleanup

Tasks must have bounded retries, exponential backoff where appropriate and structured failure logging.

### Definition of done

- Health checks cover web, database, Redis and worker availability.
- WebSocket connection works in staging over TLS.
- A Stripe test webhook reaches the verified endpoint.
- Media upload uses signed/private staging and cannot execute uploaded content.

---

## 10. Phase 2 — Shared types, settings and audit foundation

### 10.1 `PlatformSetting`

Implement typed settings through a singleton or key/value model with schema validation. Changes require staff-admin permission and audit logging.

| Key | Type | Default | Validation |
|---|---:|---:|---|
| `finance.enabled` | bool | `true` | global kill switch |
| `finance.annual_rate_percent` | decimal(7,4) | `5.0000` | `0–100` |
| `finance.term_months` | int | `48` | `1–360` |
| `finance.down_payment_percent` | decimal(7,4) | `20.0000` | `0–99.99` |
| `individual.free_listing_count` | int | `1` | `0–100` |
| `individual.free_period_days` | int | `365` | `1–3650` |
| `individual.free_publish_days` | int | `30` | `1–3650` |
| `individual.paid_publish_days` | int | `30` | `1–3650` |
| `individual.paid_entitlement_valid_days` | int | `365` | `1–3650` |
| `media.private_base_image_limit` | int | `1` | exactly `1` for this release |
| `media.private_base_video_limit` | int | `0` | exactly `0` for this release |
| `media.upgraded_image_limit` | int | `20` | `1–50` |
| `media.upgraded_video_limit` | int | `1` | `0–3` |
| `media.broker_image_limit` | int | `20` | `1–50` |
| `media.broker_video_limit` | int | `1` | `0–3` |

Settings responses include a monotonically increasing `settings_version` and `updated_at`. Finance quotes store the version used so historical UI/support cases are reproducible.

### 10.2 Audit event

Minimum fields:

```text
id UUID
actor_user nullable FK
actor_type USER | SYSTEM | STRIPE
action string
target_type string
target_id string
request_id string
source WEB | API | ADMIN | TASK | WEBHOOK
before JSON nullable
after JSON nullable
metadata JSON
ip_hash nullable
created_at timestamptz
```

Audit events are append-only at application level. Ordinary staff cannot edit or delete them.

### Definition of done

- Invalid configuration cannot be saved.
- All configuration changes appear in audit history.
- Settings cache invalidates only after successful commit.
- Tests prove global defaults are applied when listing overrides are absent.

---

## 11. Core data model specification

All primary keys should be UUIDs unless the existing system has a stable alternative. All timestamps are timezone-aware UTC. User-facing dates are localized at presentation time. Monetary fields use `Decimal`, never binary floating point.

### 11.1 Accounts and organizations

#### `User`

Required relevant fields:

```text
id
email unique, normalized
email_verified_at nullable
primary_role BUYER | PRIVATE_SELLER | BROKER | SERVICE_PROVIDER | STAFF
is_active
locale EN | IT | ES
created_at, updated_at
```

#### `BrokerOrganization`

```text
id
name
slug unique
status DRAFT | PENDING | ACTIVE | SUSPENDED
public_email
public_phone
website_url nullable
auto_approve_listings bool default false
auto_approve_changed_by nullable FK User
auto_approve_changed_at nullable
created_at, updated_at
```

Only staff admin can change `auto_approve_listings`. Broker users may see the current policy but cannot change it.

#### `BrokerMembership`

```text
user FK
broker FK
role ADMIN | MANAGER | AGENT | VIEWER
can_edit_listings bool
can_manage_team bool
can_read_messages bool
is_active
unique(user, broker)
```

#### `ProfessionalProfile`

```text
id
owner_user FK
display_name
slug unique
short_description
description
public_email
public_phone
website_url nullable
address fields
service_area JSON or normalized relation
status DRAFT | PENDING | ACTIVE | SUSPENDED
created_at, updated_at
```

Do not persist decorative claims, invented certifications or irrelevant personal details merely because they existed in a prototype.

### 11.2 Service catalog

#### `ServiceCategory`

```text
id
name_en, name_it, name_es
slug unique
description_en, description_it, description_es
icon_key
display_order
is_active
seo_title_*
seo_description_*
```

The six SEO service pages are category/landing records flagged `has_seo_page=true`; they are not separate hard-coded templates with divergent data models.

#### `ProfessionalService`

```text
id
professional FK
category FK
title_*, description_*
service_area
is_active
created_at, updated_at
unique(professional, category, title_en) or an equivalent normalized constraint
```

### 11.3 Taxonomy

#### `BoatBrand`

```text
id
name
slug unique
normalized_name unique
is_active
created_by, updated_by
created_at, updated_at
```

#### `BoatModel`

```text
id
brand FK
name
slug
normalized_name
is_other_placeholder bool default false
is_active
created_by, updated_by
created_at, updated_at
unique(brand, normalized_name)
unique(brand) where is_other_placeholder=true
```

Each active brand has exactly one internal `Other` placeholder. The UI lists ordinary active models first and the `Other` choice last, separated visually after an unsuccessful search.

### 11.4 Listing and public snapshots

#### `BoatListing`

```text
id
owner_user nullable FK
broker nullable FK
seller_type PRIVATE | BROKER
brand FK BoatBrand
model FK BoatModel
custom_model_name blank allowed
manufacture_year smallint
status ListingStatus
currency ISO-4217, initially EUR
price decimal(14,2)
show_finance_estimate bool default false
finance_down_payment_override_percent nullable decimal(7,4)
finance_rate_override_percent nullable decimal(7,4)
finance_term_override_months nullable int
publication_source FREE_ENTITLEMENT | PAID_ENTITLEMENT | BROKER_POLICY
consumed_entitlement nullable FK
published_at nullable
expires_at nullable
current_public_snapshot nullable FK
view_count_cached bigint default 0
created_by, updated_by
created_at, updated_at
```

Database/application constraints:

- `seller_type=PRIVATE` requires `owner_user` and forbids `broker`.
- `seller_type=BROKER` requires `broker`.
- `show_finance_estimate=true` is valid only for `seller_type=BROKER`.
- A non-Other model requires blank `custom_model_name`.
- The Other model requires trimmed custom text between 2 and 100 characters.
- Manufacture year must be between 1900 and current year + 1.
- Price must be positive when publication is submitted.

#### `ListingSnapshot`

Immutable, versioned public content:

```text
id
listing FK
version positive int
approved_revision nullable FK
brand_name_snapshot
model_name_snapshot
custom_model_name_snapshot
manufacture_year_snapshot
title_*, description_*
specifications JSON with schema version
location fields
currency, price
media_manifest JSON
approved_by FK User
approved_at
unique(listing, version)
```

Public pages read from `current_public_snapshot`, not mutable draft fields. Taxonomy corrections by staff must create a new snapshot and audit event rather than rewriting history invisibly.

#### `ListingRevision`

```text
id
listing FK
revision_number
base_snapshot FK
state RevisionStatus
payload JSON validated against explicit schema
submitted_by FK
submitted_at nullable
decided_by nullable FK
decided_at nullable
decision_note nullable
created_at, updated_at
unique(listing, revision_number)
```

Only fields explicitly allowed by role are accepted in `payload`; unknown fields return validation errors. For a private seller after first publication, `brand_id`, `model_id`, `custom_model_name` and `manufacture_year` are rejected with `immutable_after_publication`.

### 11.5 Media

#### `ListingMedia`

```text
id
listing FK
media_type IMAGE | VIDEO
storage_key
status UPLOADING | SCANNING | PROCESSING | READY | REJECTED
mime_type
byte_size
width nullable
height nullable
duration_seconds nullable
sort_order
checksum_sha256
created_by
created_at
```

Only `READY` media can enter a submitted revision/public snapshot. Media count limits include all non-rejected items to prevent concurrent upload bypasses.

### 11.6 Finance

#### `FinanceConfigurationVersion`

```text
id
version unique positive int
annual_rate_percent decimal(7,4)
term_months positive int
down_payment_percent decimal(7,4)
is_active
created_by
created_at
```

Exactly one configuration is active. Updating settings creates a new version; it does not rewrite previous quotes.

#### `FinanceQuoteLog` (privacy-light analytics, optional but recommended)

```text
id
listing nullable FK
viewer_user nullable FK
principal
annual_rate_percent
term_months
down_payment_percent
monthly_payment
total_payment
total_interest
configuration_version
source CARD | FINANCE_PAGE
created_at
```

Do not store a quote log for every card rendered. Log only an explicit calculator interaction or detail request. Aggregate/expire logs under the analytics retention policy.

### 11.7 Views

#### `ListingView`

```text
id
listing FK
viewer_type USER | ANONYMOUS
viewer_user nullable FK
viewer_hash nullable char(64)
first_viewed_at
last_seen_at
user_agent_class HUMAN | BOT | UNKNOWN
```

Constraints:

- Unique `(listing, viewer_user)` where `viewer_user` is not null.
- Unique `(listing, viewer_hash)` where `viewer_hash` is not null.
- Exactly one of viewer user and viewer hash is present.

`viewer_hash = HMAC-SHA256(CONTACT_HASH_SECRET, canonical_client_ip)`. Do not store raw IP in `ListingView`. Proxy headers are trusted only from configured reverse proxies. This is a practical uniqueness control, not a perfect identity claim.

### 11.8 Messaging and contact access

#### `Conversation`

```text
id
conversation_type LISTING_INQUIRY | BROKER_INQUIRY | PROFESSIONAL_INQUIRY | SUPPORT
initiator FK User
broker nullable FK
professional nullable FK
listing nullable FK
status OPEN | ARCHIVED | BLOCKED
last_message_at
created_at
```

Exactly one valid context combination is permitted. A listing inquiry may derive its recipient from listing ownership; clients may not choose an arbitrary recipient ID.

#### `Message`

```text
id
conversation FK
sender FK User
body text
sender_email_snapshot
is_system bool
created_at
read_at nullable
```

#### `ContactAccessGrant`

```text
id
viewer FK User
target_type BROKER | PROFESSIONAL
broker nullable FK
professional nullable FK
source_conversation FK
granted_at
revoked_at nullable
unique active grant per viewer and target
```

The grant is created atomically after the first valid non-system inquiry message is saved. It reveals only configured public business contact fields. It never exposes private account email, internal notes or team-member personal details.

### 11.9 Entitlements and products

#### `MarketplaceProduct`

```text
id
code unique: INDIVIDUAL_LISTING_RIGHT | LISTING_MEDIA_UPGRADE
name_en, name_it, name_es
description_*
stripe_product_id
stripe_price_id
currency
display_amount decimal(12,2)
entitlement_valid_days
publication_days nullable
is_active
display_order
created_by, updated_by
created_at, updated_at
```

Stripe is the payment amount authority at Checkout creation time. `display_amount` is for UI and must be synchronized/validated; mismatch blocks checkout and alerts staff.

#### `UserEntitlement`

```text
id
user FK
entitlement_type FREE_LISTING | PAID_LISTING | MEDIA_UPGRADE
source FREE_POLICY | STRIPE_PURCHASE | STAFF_GRANT
source_payment nullable FK
listing nullable FK
state AVAILABLE | RESERVED | CONSUMED | EXPIRED | REVOKED
valid_from
valid_until
reserved_at nullable
consumed_at nullable
revoked_at nullable
metadata JSON
created_at, updated_at
```

Free use is also recorded as an entitlement/ledger entry. Do not infer historical quota solely from current listings, because listings may be deleted, archived or moderated.

#### `PaymentOrder`

```text
id
user FK
product FK
status CREATED | CHECKOUT_OPEN | PAID | FULFILLED | FAILED | EXPIRED | REFUNDED | DISPUTED
stripe_checkout_session_id unique nullable
stripe_payment_intent_id unique nullable
amount, currency
idempotency_key unique
fulfilled_entitlement nullable FK
created_at, paid_at, fulfilled_at, updated_at
```

#### `ProcessedWebhookEvent`

```text
stripe_event_id unique
event_type
payload_checksum
processed_at
result
```

### 11.10 Notifications

#### `Notification`

```text
id
recipient FK User
type
title_key
body_key
payload JSON
target_url
read_at nullable
created_at
```

#### `NotificationDelivery`

```text
notification FK
channel IN_APP | WEBSOCKET | EMAIL
status QUEUED | SENT | FAILED | SKIPPED
attempt_count
provider_message_id nullable
last_error_code nullable
sent_at nullable
unique(notification, channel)
```

---

## 12. Phase 3 — Identity, organizations and permissions

### Backend work

1. Implement role and organization membership permission classes.
2. Resolve listing ownership exclusively on the server.
3. Require verified email for inquiry submission, listing submission and Checkout creation.
4. Add object-level authorization for conversations, listings, revisions and staff actions.
5. Prevent suspended users/organizations from creating, submitting or purchasing new rights.
6. Ensure staff impersonation, if available, is read-only by default and prominently audited.

### Frontend work

- Navigation is derived from the authenticated session/permissions endpoint.
- Unauthorized links are hidden, but direct route access is still rejected by the backend.
- A permission failure returns a clear 403 screen; missing authentication returns 401/redirect with safe `next` URL.

### Acceptance tests

- A broker agent cannot edit another broker’s listing.
- A private seller cannot send `seller_type=BROKER` or enable finance through a crafted request.
- A moderator cannot change payment products unless separately granted staff-admin permission.
- An inactive user cannot submit an inquiry from an old session.

---

## 13. Phase 4 — Brand/model taxonomy and Other workflow

### 13.1 API behavior

`GET /api/v1/boat-brands/?q=<text>`

- Returns active brands only.
- Case/accent-insensitive search.
- Paginated, stable alphabetical order.
- Minimum query length for remote search: 1; rate limited.

`GET /api/v1/boat-models/?brand_id=<uuid>&q=<text>`

- `brand_id` is required.
- Returns models belonging to the selected brand only.
- The Other option is included last. When search has no ordinary match, response includes `show_other_prompt=true`.

Example:

```json
{
  "results": [],
  "other": {"id": "uuid", "label": "Other"},
  "show_other_prompt": true
}
```

### 13.2 Form behavior

1. Brand is a searchable dropdown backed by API results.
2. Model remains disabled until brand is selected.
3. Changing brand clears model and custom model text.
4. Selecting Other reveals required label “Enter the model name”.
5. Custom name is whitespace-collapsed, Unicode-normalized and rejected if it contains only punctuation.
6. Duplicate hints may suggest an existing model, but never silently replace user input.
7. On cards/detail, display `Model: Other — McKenzie` and retain the selected brand separately.
8. In boat-search filters, choosing Model = Other returns every listing whose model is the Other placeholder, regardless of custom text. A free-text query can still match `custom_model_name`.

### 13.3 Staff taxonomy UI

Staff `/dashboard/staff/taxonomy/` includes:

- Brands table and create/edit/deactivate actions.
- Models filtered by brand.
- Queue of listings using Other, with custom name, owner, date and status.
- “Create model and map listing” transaction.
- “Map to existing model” transaction.
- Merge preview showing affected listings.

Mapping rules:

- Mapping updates the draft taxonomy reference.
- If the listing has an approved public snapshot, staff creates and approves a taxonomy-only revision/new snapshot in the same transaction.
- Custom text is preserved in audit metadata, then cleared from the active listing after successful mapping.
- Never delete a model referenced by listings; deactivate or merge it.

### 13.4 Notification event

When an Other-model listing is submitted, emit `listing.other_model_submitted` after commit. Notify taxonomy staff in-app, over WebSocket if connected and by one deduplicated email per listing submission. Do not send on each draft keystroke/save.

### Definition of done

- No free-text brand is accepted.
- Search and dropdown are keyboard accessible.
- Concurrent staff mapping cannot create duplicate normalized models.
- Other filter and free-text search return the expected listings.

---

## 14. Phase 5 — Merge Services and Professionals

### 14.1 Information architecture

The Professionals directory is the visual and structural base. Move from the former Services landing page only content not already represented:

- Approved service-category introductions.
- Links to the six SEO service pages.
- Category discovery/filter controls.
- Existing approved service-request CTA.

Do not duplicate the same category in separate “service” and “professional” sections. The combined page contains:

1. Hero with title, concise explanation and category/location search.
2. Service category grid sourced from `ServiceCategory`.
3. Professional results sourced from active `ProfessionalProfile` and services.
4. Optional approved advertisement interstitial only in its established public placement.
5. SEO links to the six individual service pages.

### 14.2 Professional detail template

Use the public broker profile’s layout system, not its broker-only content. Required sections:

- Identity header: logo/photo, name, primary categories, location/service area.
- Short verified/profile status language without implying government certification.
- About.
- Services offered.
- Service area.
- Portfolio/gallery only when real backend records exist.
- Shared inquiry form.
- Blurred contact panel governed by `ContactAccessService`.
- Related professionals from the same category, excluding the current profile.

Remove excessive fields such as invented revenue, response guarantees, bank/registry affiliations, irrelevant personal biography, transaction volume and unsupported certifications.

### 14.3 Migration

1. Create a mapping table from old service/provider records to canonical professional/category records.
2. Deduplicate by explicit IDs and normalized name/address; never merge solely on display name without review.
3. Copy missing service descriptions/categories.
4. Preserve professional slugs where unique; create deterministic redirects for changed slugs.
5. Generate canonical tags and update sitemap.
6. Leave six SEO service records independent but linked to the combined directory.

### Definition of done

- One combined directory exists; no duplicate index content remains.
- Both retired directory URLs return a single-hop 301.
- Every displayed category/provider is database-backed.
- Professional detail is visually aligned with broker detail and contains no unsupported fields.

---

## 15. Phase 6 — Shared inquiry form and messaging core

### 15.1 Single form component

Component name should be equivalent to `InquiryForm`; do not create broker-, professional- and listing-specific copies.

Fields:

| Field | Rule |
|---|---|
| Full name | Required; prefilled from profile; 2–120 characters |
| Email | Required; verified account email; displayed read-only with “Update in account” link |
| Phone | Optional; E.164-compatible input and country selector |
| Subject | Context-derived default, editable; 3–150 characters |
| Message | Required; 20–4000 characters |
| Privacy consent | Required checkbox with versioned policy reference |
| Marketing consent | Optional, separate, unchecked; never required for inquiry |
| Context | Hidden/server-derived entity/listing, never trusted from arbitrary client data |

Honeypot, rate limiting and abuse detection are required. CAPTCHA may be introduced only behind a risk threshold, not as a default barrier.

### 15.2 Guest behavior

- Guest may type into the form.
- On submit, preserve non-sensitive draft fields in a short-lived signed session, redirect to login/register with validated local `next` URL.
- After verified authentication, restore the form, show the recipient/context again and require the user to confirm Send.
- Do not send an inquiry automatically after login.

### 15.3 Submission transaction

Within one atomic operation:

1. Validate user, recipient status, context and rate limit.
2. Get or create an open conversation for the chosen policy.
3. Save the message and sender email snapshot.
4. Create contact access grant if none exists.
5. Create recipient in-app notification.
6. Register post-commit jobs for WebSocket and email.

Return `201 Created` only after the database transaction succeeds.

### 15.4 Recipient delivery

- Broker listing inquiry → owning broker conversation inbox; team members with `can_read_messages` receive in-app visibility. Email goes to the broker’s configured notification recipients, not every member by default.
- Broker profile inquiry → same broker inbox.
- Professional inquiry → professional inbox.
- Private-seller listing inquiry → private-seller messages.

Email includes a safe excerpt and a link to the platform conversation. It must not expose the recipient’s hidden contact details to the sender.

### 15.5 API

`POST /api/v1/inquiries/`

```json
{
  "context_type": "LISTING",
  "context_id": "uuid",
  "full_name": "Ada Rossi",
  "email": "ada@example.com",
  "phone": "+390000000000",
  "subject": "Question about the Azimut Atlantis 43",
  "message": "I would like to arrange a viewing next week.",
  "privacy_policy_version": "2026-09"
}
```

Success:

```json
{
  "conversation_id": "uuid",
  "message_id": "uuid",
  "contact_access": "GRANTED",
  "next_url": "/dashboard/messages/<conversation-id>/"
}
```

Error codes include `authentication_required`, `email_verification_required`, `recipient_unavailable`, `invalid_context`, `rate_limited`, `consent_required` and field errors.

### Definition of done

- All inquiry locations render the same component/version.
- Email exists in every variant and cannot be forged to another account without a verified email-change flow.
- One backend service handles all types.
- Messages appear in the correct recipient inbox and sender conversation list.

---

## 16. Phase 7 — Contact privacy, blur and reveal

### API contract

Public broker/professional responses never include raw contact strings when access is absent. They return:

```json
{
  "contact": {
    "state": "LOCKED",
    "email_mask": "i••••@example.com",
    "phone_mask": "+34 ••• ••• ••7",
    "unlock_rule": "SEND_INQUIRY"
  }
}
```

After a successful inquiry by the current user:

```json
{
  "contact": {
    "state": "GRANTED",
    "email": "info@example.com",
    "phone": "+34900111222",
    "granted_at": "..."
  }
}
```

### UI rules

- Locked email and phone use a non-selectable blur/mask treatment plus lock icon and text: “Send a message through NAUTA to unlock business contact details.”
- Never place the unblurred value in HTML, page source, CSS pseudo-content, `aria-label`, analytics payload or preloaded JSON.
- Accessibility: screen readers hear the masked value and unlock explanation, not the secret value.
- After successful send, refetch contact authorization; do not rely on client-side unblur alone.
- Grant is scoped to `(viewer, broker)` or `(viewer, professional)`, so it applies across that entity’s profile and listings.
- Staff can revoke grants for abuse; suspended entity contact becomes unavailable.

### Acceptance tests

- Inspecting the DOM/network as an unauthorized user reveals no raw contact data.
- Sending to Broker A does not unlock Broker B.
- A failed or rate-limited message does not unlock contact.
- A successful transaction creates exactly one grant despite concurrent duplicate requests.

---

## 17. Phase 8 — Finance configuration and calculation engine

### 17.1 Formula

Use the standard fixed-payment amortization formula:

```text
price = listing price
down_payment = price × (down_payment_percent / 100)
P = price − down_payment
r = (annual_rate_percent / 100) / 12
n = term_months

if r = 0:
    monthly_payment = P / n
else:
    monthly_payment = P × [r × (1 + r)^n] / [(1 + r)^n − 1]

total_payment = monthly_payment × n
total_interest = total_payment − P
```

Use `Decimal` with at least 28 digits of internal precision. Round currency results to two decimals with `ROUND_HALF_UP` only at API/presentation boundaries. Do not round intermediate values.

Default examples used for automated tests:

| Price | Down payment | Principal | Rate | Term | Expected monthly payment |
|---:|---:|---:|---:|---:|---:|
| €459,000 | 20% (€91,800) | €367,200 | 5% | 48 | €8,456.36 |
| €248,000 | 20% (€49,600) | €198,400 | 5% | 48 | €4,569.01 |

The formula corresponds to the widely used amortizing-loan payment formula documented in references such as [Investopedia’s mortgage calculator explanation](https://www.investopedia.com/mortgage-calculator-5084794) and must be covered by independent test vectors. The Django implementation should follow the framework’s documented transaction and validation mechanisms; see [Django database transactions](https://docs.djangoproject.com/en/5.2/topics/db/transactions/) and [model constraints](https://docs.djangoproject.com/en/5.2/ref/models/constraints/).

### 17.2 Configuration precedence

For a broker listing:

1. Start with active global configuration.
2. If staff permits broker overrides and valid listing override fields are present, use them.
3. Store/return the effective source of each value: `GLOBAL` or `LISTING_OVERRIDE`.

For release 1.0, broker overrides are supported but optional. The listing form initially shows global defaults and allows a broker to override rate, term and down payment only when “Show financing estimate” is on. Staff can disable override capability globally without altering existing stored values; disabled overrides are ignored, not deleted.

### 17.3 Validation

- Price: `0.01–999,999,999.99` in listing currency.
- Annual rate: `0–100%`.
- Term: `1–360` whole months.
- Down payment: `0–99.99%`.
- Principal must remain positive.
- Unsupported currency returns `unsupported_currency`.

### 17.4 Quote API

`POST /api/v1/finance/quotes/`

Accepted contexts:

1. `listing_id`: server loads price and permitted effective settings.
2. Manual finance-page values: authenticated or guest calculation using public config.

Example request:

```json
{
  "listing_id": "uuid",
  "price": "459000.00",
  "down_payment_percent": "20.00",
  "annual_rate_percent": "5.00",
  "term_months": 48,
  "currency": "EUR"
}
```

When `listing_id` is supplied, a client-supplied price must either be omitted or match; the server value wins. Response:

```json
{
  "currency": "EUR",
  "price": "459000.00",
  "down_payment_amount": "91800.00",
  "principal": "367200.00",
  "annual_rate_percent": "5.0000",
  "term_months": 48,
  "monthly_payment": "8456.36",
  "total_payment": "405905.12",
  "total_interest": "38705.12",
  "configuration_version": 7,
  "disclaimer_key": "finance.illustrative_disclaimer"
}
```

`total_payment` here means total loan installments, excluding down payment. The UI may separately show `overall_cash_outlay = total_payment + down_payment_amount` but must label it clearly.

### 17.5 Cache and updates

- Cache active finance configuration by version.
- A staff update commits a new active version and invalidates cache after commit.
- Card APIs calculate with current effective configuration at request time; therefore changes automatically affect boat cards and the finance page without editing listings.
- If SEO/page caching exists, include finance configuration version in the cache key or purge affected caches.

### Definition of done

- Python unit tests cover zero interest, defaults, boundary values and rounding.
- Frontend and backend results match exactly; frontend may preview but server response is authoritative.
- Changing the Django setting changes card and finance-page results after cache invalidation.
- No page presents the estimate as a lender offer.

---

## 18. Phase 9 — Finance card UI and broker listing toggle

### 18.1 Boat-card placement

Follow the approved reference layout:

- View count sits in the card’s upper metadata row next to an eye icon.
- Price remains in the lower pricing row, left aligned.
- When eligible, estimated monthly payment appears in the same row, right aligned, with label `Estimated payment` and value `€X,XXX/month*`.
- Below the pricing row, show link/button `Calculate your financing` with a directional arrow.
- Optional details disclosure may show down payment, financed principal, term, rate, total installments and total interest. It must use live calculation results, never fixed sample copy.
- The disclaimer asterisk resolves within the card/list region and on the finance page.

### 18.2 Eligibility rule

Finance UI is displayed only when all conditions are true:

```text
listing.seller_type == BROKER
AND listing.show_finance_estimate == true
AND finance.enabled == true
AND listing.price is valid
AND listing.currency is supported
AND listing.status == PUBLISHED
```

If any condition fails, remove the entire estimated-payment column, calculator CTA and disclosure. Do not show zeros or disabled finance placeholders.

### 18.3 New-tab behavior

The calculator CTA opens:

```text
/financing/?listing=<uuid>&price=<server-formatted-price>&currency=EUR
```

Use `target="_blank" rel="noopener noreferrer"`. The finance page treats `listing` as the authority and ignores tampered price parameters. Query price exists only for immediate display fallback while loading.

### 18.4 Broker create/edit form

Field group title: `Financing estimate`.

- Toggle: `Show an estimated monthly payment on this listing`.
- Default for new broker listing: off.
- When off, override fields are hidden and cleared from the submitted effective UI state; stored overrides may remain but are ignored.
- When on, show global defaults and optional “Use custom assumptions for this listing”.
- Save requires no staff finance approval separate from the normal listing workflow.
- Copy states clearly that the estimate is illustrative.

Private-seller forms must neither render the fields nor accept them through API payloads.

### 18.5 API representation

Published listing card response:

```json
{
  "id": "uuid",
  "seller_type": "BROKER",
  "price": {"amount": "459000.00", "currency": "EUR"},
  "view_count": 149,
  "finance": {
    "visible": true,
    "monthly_payment": "8456.36",
    "annual_rate_percent": "5.0000",
    "term_months": 48,
    "down_payment_percent": "20.0000",
    "configuration_version": 7
  }
}
```

For ineligible listings return `"finance": {"visible": false}` and no assumptions.

### Acceptance tests

- Broker toggle off: no installment/CTA in list or detail.
- Broker toggle on: list and finance page use equal assumptions/results.
- Private seller crafted payload is rejected and UI remains absent.
- CTA opens a separate tab without granting opener access.
- Staff changing defaults updates all non-overridden eligible cards.

---

## 19. Phase 10 — Unique listing views

### 19.1 Counted event

A view is considered only on a successful human GET of a published boat detail page/API detail view. Search-result card impressions do not count. The event is excluded when:

- Viewer is the private listing owner.
- Viewer belongs to the owning broker organization.
- Viewer is staff.
- Request is HEAD, prefetch/prerender, health check or known verified bot.
- Listing is not published.

### 19.2 Identity

- Authenticated eligible viewer: `viewer_user`.
- Anonymous eligible viewer: HMAC hash of canonical client IP.
- If an anonymous viewer later logs in, the authenticated identity may count separately; do not attempt risky probabilistic identity merging.
- A household sharing an IP may count as one anonymous viewer. UI copy says “views”, not “people”.

### 19.3 Write path

1. Resolve viewer identity.
2. `INSERT ... ON CONFLICT DO UPDATE last_seen_at` or equivalent.
3. Increment `view_count_cached` only when a new unique row is inserted.
4. Run in a short transaction; do not delay page rendering if an async durable event pipeline already exists.
5. Provide a reconciliation task that recomputes cached counts from rows.

The count must not increment on refresh, repeated API fetch or a second browser using the same anonymous IP.

### 19.4 Privacy and retention

- Never expose viewer identities to sellers; only aggregate count.
- Raw IP may exist briefly in normal security/access logs under the site privacy policy but not in the analytics table.
- Delete view identity rows when the listing is permanently deleted; otherwise retain while necessary for lifetime uniqueness and document the purpose/retention.
- Restrict access to row-level analytics to authorized staff/engineering; sellers receive aggregate values only.

### 19.5 UI

- All published boat cards show eye icon + localized integer, including zero if the design calls for it.
- Boat detail and owner dashboards use the same aggregate.
- Use compact formatting only above 9,999 and provide exact value in accessible label/title.

### Acceptance tests

- First eligible view increments from 0 to 1.
- Repeat views from same identity remain 1.
- Two authenticated users count as 2.
- Owner/staff/bot do not count.
- Concurrent identical requests produce one row and one increment.

---

## 20. Phase 11 — Listing workflow, revisions and immutable fields

### 20.1 Initial private-seller publication

1. User saves draft.
2. Backend validates eligibility and reserves/chooses entitlement.
3. Media must be READY and within allowance.
4. Submit atomically consumes entitlement and creates `PENDING_APPROVAL` revision/listing state.
5. Listing is not publicly queryable.
6. Staff receives notification after commit.
7. Staff approves, requests changes or rejects.
8. Approval creates snapshot version 1, sets `published_at`, calculates `expires_at` from the consumed entitlement/policy and publishes.

### 20.2 Post-publication private edit

- Brand, model, custom model and manufacture year are locked in UI and backend.
- Editable examples: price, description, specifications, location, contact preference and media within entitlement.
- On save as draft, changes stay private.
- On submit, revision becomes `SUBMITTED` and staff is notified.
- Existing approved snapshot remains live. UI tells seller: “Your approved version remains visible while changes are reviewed.”
- Approval creates next snapshot and makes it current atomically.
- Rejection leaves the approved public snapshot untouched.

### 20.3 Immutable-field correction

If brand/model/year is genuinely wrong after publication:

- Seller cannot edit it.
- Seller submits a support/moderation request with reason/evidence.
- Staff admin may create a staff-authored correction revision.
- The action requires a note and audit event.
- Staff approval generates a new snapshot; historical snapshot remains immutable.

### 20.4 Broker listing edits

- If broker auto-approval is on, valid create/edit submissions publish a new snapshot immediately.
- If off, initial submissions and substantive public-field edits require approval; old snapshot remains live for edits.
- Staff may define clearly enumerated non-substantive fields that auto-publish, but default is that all public content fields are substantive.

### 20.5 Optimistic locking

All edit submissions include listing/revision version. Stale updates return `409 conflict` with current version metadata. Do not silently overwrite another browser/session edit.

### Definition of done

- No pending private listing leaks through search, sitemap, direct slug or API.
- Locked field manipulation fails server-side.
- Old public content survives rejected edits.
- Every decision records actor, note and timestamps.

---

## 21. Phase 12 — Broker unlimited listings and auto-approval

### Rules

- Broker organizations have no numeric listing quota in this release.
- “Unlimited” does not bypass validation, moderation, suspension, media limits or abuse controls.
- `auto_approve_listings=false` by default for migrated/new brokers unless staff explicitly enables it.
- Only staff admin may toggle policy; change requires a reason.
- Enabling policy affects future submissions, not currently pending submissions automatically.
- Disabling policy affects future submissions; current published listings stay live unless moderated.
- Staff may bulk approve existing pending broker submissions as a separate explicit action with confirmation and audit.

### Staff broker UI

Broker detail includes:

- Account status.
- Listing counts by status.
- Auto-approval switch with current state, last changed by/at.
- Confirmation modal explaining future-only effect.
- Mandatory reason field.
- Audit history.

### Acceptance tests

- A broker can create listing 101 without quota failure.
- An ordinary broker user cannot toggle auto-approval through UI or API.
- Auto-approved submission creates snapshot/published state atomically.
- Invalid listing never publishes even when auto-approval is on.

---

## 22. Phase 13 — Individual free quota and entitlement enforcement

### 22.1 Free policy

Default: one free listing activation within a rolling 365-day period; approved publication lasts 30 days.

The rolling period starts when the free entitlement is consumed on submission. A rejected submission can be corrected without consuming a second right. If staff permanently rejects for policy abuse, the right remains consumed unless staff explicitly restores it with an audited remedy.

Deleting, archiving or selling a boat does not reset free quota. When 365 days have elapsed since the last free consumption, the user becomes eligible for a new free entitlement on the next eligibility calculation.

### 22.2 Eligibility service

`ListingEligibilityService.for_user(user)` returns:

```json
{
  "can_start_listing": false,
  "recommended_entitlement": null,
  "free": {
    "available": false,
    "used_at": "...",
    "next_available_at": "...",
    "publication_days": 30
  },
  "paid_listing_rights_available": 0,
  "blocking_reason": "FREE_ALLOWANCE_USED",
  "purchase_product_code": "INDIVIDUAL_LISTING_RIGHT"
}
```

Evaluate at:

- Sell landing CTA render.
- Private dashboard CTA render.
- Create route entry.
- Draft creation API.
- Final submission inside locked transaction.

The last check is authoritative and prevents multiple-tab races.

### 22.3 UI when unavailable

- Primary “Start a listing” control is visually disabled and does not navigate to an empty form.
- Adjacent/high-priority CTA: “You have used your free listing. Buy a new listing right.”
- Opening the CTA shows product name, price, currency, what one right includes, publication duration, entitlement expiry and refund/help link.
- Confirming creates a Stripe Checkout Session and redirects to Stripe.
- If a paid right already exists, show “Use an available listing right” instead of purchase.

### 22.4 API enforcement

- `POST /api/v1/listings/drafts/` returns `403 listing_entitlement_required` when no right exists.
- It may reserve an available paid right or mark intended free eligibility without consuming until submit.
- `POST /api/v1/listings/<id>/submit/` locks entitlement/quota rows, revalidates and consumes once.
- Concurrent requests cannot consume one entitlement twice.

### 22.5 Expiry

A daily task marks due listings `EXPIRED`, removes them from public search/sitemap, preserves dashboard access and notifies owner before and at expiry. Default reminders: 7 days and 1 day before expiration. Reactivation requires a new available paid listing right unless the expiry resulted from a staff error.

### Definition of done

- Free limits are adjustable without code deployment.
- UI and API agree on eligibility.
- Multiple tabs cannot create multiple free listings.
- Expired listings disappear publicly and remain manageable privately.

---

## 23. Phase 14 — Stripe products, Checkout and fulfillment

### 23.1 Products

Staff product management supports exactly these product codes in this release:

1. `INDIVIDUAL_LISTING_RIGHT`
   - Grants one paid listing entitlement.
   - One-time payment.
   - Default entitlement validity: 365 days from purchase.
   - Default publication: 30 days from staff approval/publication.
2. `LISTING_MEDIA_UPGRADE`
   - Grants one upgrade bound to one eligible private-seller listing.
   - Raises total allowance to 20 images and 1 video.
   - Cannot be transferred after binding.

Staff may edit localized display copy, active state, Stripe product/price IDs and policy durations. Staff does not enter card data or manually mark a browser redirect as paid.

### 23.2 Checkout creation

`POST /api/v1/checkout-sessions/`

```json
{
  "product_code": "INDIVIDUAL_LISTING_RIGHT",
  "listing_id": null,
  "return_url": "/dashboard/private-seller/listings/"
}
```

Rules:

- Authentication and verified email required.
- Media upgrade requires a private listing owned by the user and not already upgraded.
- Product must be active.
- Server loads Stripe Price; client cannot submit amount/currency.
- Use an idempotency key derived from order UUID and operation.
- Create local `PaymentOrder` before Stripe session.
- Store internal order/user/product identifiers in Stripe metadata, not personal message content.
- Success/cancel URLs are allowlisted local routes.

### 23.3 Webhook processing

Endpoint: `POST /api/v1/stripe/webhook/`

1. Read raw body.
2. Verify Stripe signature with the environment-specific secret.
3. Insert `ProcessedWebhookEvent`; duplicate event ID returns HTTP 200 without re-fulfillment.
4. For completed/paid Checkout, lock `PaymentOrder`.
5. Verify expected user, product, amount, currency, mode and payment status.
6. Mark paid and create exactly one entitlement.
7. Link entitlement and mark fulfilled.
8. Commit.
9. After commit, notify user and refresh WebSocket eligibility state.

The success page polls/read-fetches order status and may show “Payment received; activating your right” until webhook fulfillment completes. It must never grant the right itself.

Stripe explicitly recommends webhook-driven Checkout fulfillment because customers may not reach the success page; implementation must follow [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment) and verify event signatures per [Stripe webhooks](https://docs.stripe.com/webhooks).

### 23.4 Refunds/disputes

- Unused entitlement: revoke on confirmed full refund.
- Reserved entitlement: release reservation, then revoke.
- Consumed/published entitlement: do not silently unpublish solely on a webhook; mark payment case for staff review, notify staff and apply documented commercial policy.
- Chargebacks/disputes create high-priority staff notification and audit event.
- Refund action in staff UI calls a dedicated service; do not alter Stripe state by editing database fields.

### 23.5 Staff product UI

`/dashboard/staff/products/` cards/tables show:

- Product name and code.
- Active/inactive.
- Current display price/currency.
- Stripe Price ID validation state.
- Entitlement/publication durations.
- Purchases and fulfillment failures (counts, not financial analytics beyond product operations).
- Edit and deactivate actions.

Every card field is backend-backed. A warning is shown if stored display amount differs from Stripe’s current Price; Checkout is blocked until reconciled.

### Acceptance tests

- Duplicate webhook produces one entitlement.
- Forged/invalid signature produces 400 and no state change.
- Browser success URL alone grants nothing.
- Currency/amount mismatch blocks fulfillment and alerts staff.
- User cannot buy a media upgrade for another user’s listing.

---

## 24. Phase 15 — Media limits, uploads and upgrade

### 24.1 Allowance matrix

| Seller/context | Images | Videos | Purchase needed |
|---|---:|---:|---|
| Private seller, base | 1 | 0 | No |
| Private seller, media upgrade consumed for listing | 20 total | 1 total | Yes |
| Broker listing | 20 | 1 | No |

Limits are totals, not additional counts. A private seller who already uploaded one image and buys the upgrade can add 19 more images and one video.

### 24.2 Upload pipeline

1. Client requests upload intent with listing ID, media type, filename, MIME type and size.
2. Backend authorizes owner and calculates effective allowance under a short transaction/lock.
3. Backend rejects if current non-rejected/reserved upload slots meet limit.
4. Create `UPLOADING` media row/reservation and signed upload target.
5. Client uploads directly to private staging storage.
6. Completion endpoint validates checksum/size and queues scanning/processing.
7. Worker validates actual file signature, malware scan, dimensions/duration and re-encodes where policy requires.
8. Valid media becomes `READY`; invalid media becomes `REJECTED` with user-safe reason.
9. Stale `UPLOADING` reservations are cleaned after one hour.

### 24.3 File policy

Images:

- JPEG, PNG or WebP after signature inspection.
- Maximum original size 25 MiB.
- Strip unsafe metadata; preserve orientation correctly.
- Generate responsive derivatives and thumbnail.
- Minimum recommended resolution 1280×720; reject unusably small images below defined product threshold.

Video:

- MP4 (`video/mp4`) or WebM (`video/webm`) accepted at upload.
- Maximum 250 MiB and 120 seconds.
- Transcode to supported web delivery format, generate poster image.
- Reject files with mismatched MIME/extension or processing failure.

### 24.4 Private-seller upgrade flow

- When the base image exists, “Add more photos or video” opens media-upgrade product modal.
- If purchase is fulfilled, entitlement is available.
- User explicitly applies it to the listing; application is transactional and irreversible except staff remedy.
- Once consumed, upload controls update through API/WebSocket.
- If listing is deleted, the consumed upgrade does not return automatically.

### 24.5 Revision interaction

Media changes on published private listings are part of a revision. Newly uploaded media remain private until revision approval. Removing the public primary image must not break the live snapshot; old media remain retained/referenced until no snapshot needs them.

### Acceptance tests

- Base private user cannot create a second upload intent or video.
- Concurrent upload intents cannot exceed limit.
- Purchased upgrade applies to one owned listing only.
- Broker cannot exceed 20 images/1 video.
- Rejected files do not occupy permanent quota after cleanup.

---

## 25. Phase 16 — Role-aware listing creation and editing

### 25.1 Shared form, policy-driven fields

Use one listing form architecture with server-supplied policy capabilities:

```json
{
  "seller_type": "PRIVATE",
  "can_show_finance": false,
  "image_limit": 1,
  "video_limit": 0,
  "requires_approval": true,
  "immutable_fields": ["brand", "model", "custom_model_name", "manufacture_year"]
}
```

Do not fork two unrelated forms. Role-specific sections are conditionally rendered from permissions/policy, while backend serializers independently enforce them.

### 25.2 Form steps

1. Seller/eligibility context (not user-selectable if role fixes it).
2. Brand, model and year.
3. Boat specifications.
4. Location.
5. Description and optional user-triggered EN/IT/ES translation.
6. Media.
7. Price.
8. Broker-only finance visibility/assumptions.
9. Review, policy summary and submit.

Draft saves return field-level validation but may allow incomplete content. Final submit applies complete validation.

### 25.3 Field locking

For published private listings:

- Locked fields remain visible as read-only values with explanation.
- They are omitted from editable payload or rejected if sent.
- Provide “Request a correction” staff-support action.
- Other fields can be edited into a revision.

### 25.4 Leave/recovery behavior

- Autosave only to backend authenticated draft endpoint; local storage may hold a short-lived recovery copy but is not source of truth.
- Show save state and last saved time.
- Warn on unsaved changes.
- Preserve pending upload state accurately.

### 25.5 Translation

Allowed only on user-entered title/description/service text, user-triggered and limited to EN/IT/ES. Source text remains stored. AI output is draft text requiring user review. It does not alter taxonomy, price or finance data.

### Definition of done

- Role policy affects both UI and serializer/service.
- Draft, resume, validation, upload and submit work across supported browsers.
- Broker finance toggle exists; private form has no trace of it.
- Individual immutable fields cannot be altered after publication.

---

## 26. Phase 17 — Staff products, moderation and taxonomy operations

### 26.1 Staff navigation additions

Add:

- `Products & Entitlements` → `/dashboard/staff/products/`
- `Brand & Model Taxonomy` → `/dashboard/staff/taxonomy/`

Keep `Boats` as the main moderation queue. Do not scatter one workflow across unrelated dashboards.

### 26.2 Boats moderation queue

Required tabs/filters:

- Initial listings pending.
- Revisions pending.
- Other-model submissions.
- Suspended.
- Expiring/expired.
- Broker vs private seller.
- Submitted date/age.

Row fields:

- Listing ID/title.
- Seller and type.
- Submission type initial/revision.
- Submitted timestamp and waiting duration.
- Brand/model/year; Other clearly highlighted.
- Current public status.
- Assigned moderator.

Detail view:

- Side-by-side before/after diff for revisions.
- Media diff.
- Validation warnings.
- Entitlement/payment source summary without exposing card data.
- Audit trail.
- Actions: Approve, Request changes, Reject, Suspend where applicable.

Decision rules:

- Approval reason/note optional unless warning override exists.
- Request changes and reject require a user-visible reason.
- Decisions are atomic and idempotent; repeated click cannot create multiple snapshots.
- If another moderator already decided, return conflict and refresh.

### 26.3 Entitlement operations

Staff may:

- View entitlement ledger.
- Grant a compensatory listing/media right with mandatory reason.
- Revoke unused staff-granted right.
- Restore a right after documented staff error.

Staff must not edit Stripe-paid order status manually. Payment corrections follow Stripe/service workflows.

### 26.4 Products

Product edit fields are defined in section 23. Changes require staff-admin and confirmation. Deactivating a product stops new Checkout creation but does not invalidate previously purchased entitlements.

### 26.5 Taxonomy

Implement section 13.3 completely, including Other queue and mapping audit.

### Definition of done

- Staff can operate every new workflow without Django shell/database edits.
- All visible counters equal query results.
- Concurrent decisions are conflict-safe.
- Product, policy, broker approval and taxonomy actions are audited.

---

## 27. Phase 18 — In-app, WebSocket and email notifications

### 27.1 Events

| Event | Recipients | Channels | Deduplication key |
|---|---|---|---|
| `listing.initial_submitted` | moderation staff | in-app, WS, email | listing + submission version |
| `listing.revision_submitted` | moderation staff | in-app, WS, email | revision ID |
| `listing.other_model_submitted` | taxonomy staff | in-app, WS, email | revision/listing ID |
| `listing.approved` | owner/broker submitter | in-app, WS, email | decision ID |
| `listing.changes_requested` | submitter | in-app, WS, email | decision ID |
| `listing.rejected` | submitter | in-app, WS, email | decision ID |
| `listing.expiring` | owner | in-app, email | listing + threshold |
| `listing.expired` | owner | in-app, WS, email | listing + expiry |
| `inquiry.received` | recipient inbox members | in-app, WS, email | message ID |
| `payment.fulfilled` | buyer | in-app, WS, email | payment order ID |
| `payment.fulfillment_failed` | staff admin | in-app, WS, email | payment order ID |

### 27.2 WebSocket

Authenticated endpoint example: `/ws/notifications/`.

- Authenticate through existing secure session/token mechanism.
- Subscribe user to opaque server-derived group name; never accept arbitrary group name from client.
- Payload contains notification ID, type, translated/fallback text keys, target URL and created timestamp.
- WebSocket is an acceleration channel, not source of truth. On connect/reconnect, client fetches unread notifications over REST.
- Use Redis-backed production channel layer. In-memory layers are test/local only. Follow the Channels group/channel-layer patterns in [Channels documentation](https://channels.readthedocs.io/en/stable/topics/channel_layers.html).

### 27.3 Email

- Queue only after commit.
- Use stable event id as provider/custom idempotency metadata where possible.
- Localize by recipient locale with EN fallback.
- Include safe summary and signed-in platform URL.
- Do not include hidden recipient contact data, sensitive staff notes or full payment payload.
- Retries are bounded; permanent failure is visible to staff without rolling back the original business transaction.

### 27.4 Staff preferences

Operationally critical payment fulfillment failures cannot be disabled. Ordinary moderation digest vs immediate email preference may be configurable per staff member, but in-app notification is always created.

### Acceptance tests

- Rolled-back submission sends no email/WS event.
- Offline user sees notification after reconnect through REST.
- Retried task does not create duplicate in-app notification/delivery.
- Unauthorized WebSocket client cannot subscribe to staff groups.

---

## 28. Phase 19 — Broker dashboard simplification and messaging

### Remove

- Navigation item `Services & Surveyors`.
- The corresponding dashboard cards, data calls, routes and permissions.
- Any empty service/survey metrics left on broker home.

### Add

- Navigation item `Messages` at `/dashboard/broker/messages/`.
- Conversation list and thread layout consistent with private-seller messages.
- Filters: All, Unread, Listing inquiries, Profile inquiries, Archived.
- Conversation row: sender display name, context/listing, last message excerpt, timestamp and unread count.
- Thread: messages, context sidebar, listing/profile link and reply composer.
- Broker team access according to `can_read_messages`.

### Backend

Use the shared `Conversation`/`Message` model. Do not build a second broker-only messaging store. Mark-read and reply endpoints enforce broker organization membership.

### Dashboard metrics

Broker home may show only backend-derived useful metrics such as published listings, pending approvals, unread messages and new inquiries. Remove surveyor/service widgets completely.

### Definition of done

- No visible or API navigation remains for broker Services & Surveyors.
- Legacy route redirects once to Messages.
- Broker messages and private seller messages share components/services where practical.
- Team permissions and unread counts are correct.

---

## 29. Phase 20 — Public UI integration and responsive requirements

### 29.1 Boat cards

Every boat card uses one component and one API representation. Variants may change density but not business logic.

Required backend-backed fields:

- Primary approved image or defined placeholder.
- Boat type, year, brand/model title.
- Location.
- Key specifications.
- Approved badges only when supported by real fields/rules.
- Price/currency.
- Unique view count.
- Broker identity where applicable.
- Finance estimate and calculator link only when eligible.

Prohibited:

- Hard-coded view counts.
- Finance estimate for private sellers.
- Calculating with stale hard-coded 120 months/6.5% copy from the prototype.
- Fixed “verified documentation” claims without a real moderation/status field.
- Client-side inference of seller type from display text.

### 29.2 Broker profile

- Retain approved broker profile structure.
- Replace any specialized contact form with shared `InquiryForm`.
- Add email field through the shared component.
- Use locked contact payload/treatment until access grant exists.
- Broker listings use shared boat cards.

### 29.3 Professional profile

Implement section 14.2 and visually align with broker profile:

- Same grid, header rhythm, contact card position, inquiry form style and related-content card system.
- Professional-specific services replace broker fleet/team content.
- Remove excessive data rather than inventing equivalents.

### 29.4 Combined directory

Filters must be backed by query parameters/API:

- Category.
- Location/service area.
- Search text.
- Sort (recommended/default, alphabetical where approved).

Filter URL state must be shareable and back-button safe. Results return only active/public professionals.

### 29.5 Responsive behavior

- Minimum supported widths: 320 px mobile through 1440+ desktop.
- Card price and monthly-payment row stacks cleanly below a breakpoint; neither value truncates ambiguously.
- Finance CTA remains a real link and keyboard focusable.
- Contact lock explanation remains readable without relying on hover.
- Tables in staff/dashboard screens use responsive columns or labelled cards; do not force unusable horizontal overflow on core actions.

### 29.6 Accessibility

- WCAG 2.2 AA target.
- Visible focus indicators.
- Form labels, error summaries and field-level errors.
- Eye/lock icons have accessible text and are not the only means of conveying state.
- Dialogs trap focus, close with Escape and restore focus.
- Status color always paired with text.

### Definition of done

- Visual regression snapshots exist for key breakpoints.
- No backend-dependent UI uses fixture/demo data in production build.
- All conditional content is confirmed against API policy flags.
- Keyboard-only completion works for inquiry, listing creation, purchase entry and staff moderation.

---

## 30. API inventory and shared conventions

### 30.1 Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/session/` | user, role, permissions, locale |
| GET | `/api/v1/platform/public-settings/` | safe public finance/policy display settings |
| GET | `/api/v1/boat-brands/` | brand search |
| GET | `/api/v1/boat-models/` | model search by brand |
| GET | `/api/v1/listings/` | public listing search/cards |
| GET | `/api/v1/listings/<id>/` | public detail and counted-view integration |
| POST | `/api/v1/listings/drafts/` | create authorized draft |
| PATCH | `/api/v1/listings/<id>/draft/` | update draft/revision |
| POST | `/api/v1/listings/<id>/submit/` | submit under policy/entitlement lock |
| GET | `/api/v1/listing-eligibility/` | current private-seller eligibility |
| POST | `/api/v1/listings/<id>/media/intents/` | reserve/upload slot |
| POST | `/api/v1/media/<id>/complete/` | finalize upload and queue processing |
| POST | `/api/v1/finance/quotes/` | authoritative estimate |
| POST | `/api/v1/inquiries/` | shared inquiry submission |
| GET | `/api/v1/conversations/` | authorized inbox |
| GET/POST | `/api/v1/conversations/<id>/messages/` | thread/reply |
| GET | `/api/v1/contacts/<target-type>/<id>/` | locked/granted contact payload |
| POST | `/api/v1/checkout-sessions/` | create Stripe Checkout |
| GET | `/api/v1/payment-orders/<id>/` | poll fulfillment state |
| POST | `/api/v1/stripe/webhook/` | verified Stripe events |
| GET | `/api/v1/notifications/` | unread/history |
| POST | `/api/v1/notifications/<id>/read/` | mark read |
| GET | `/api/v1/staff/moderation/` | moderation queue |
| POST | `/api/v1/staff/revisions/<id>/decision/` | approve/request changes/reject |
| PATCH | `/api/v1/staff/brokers/<id>/approval-policy/` | auto-approval setting |
| CRUD | `/api/v1/staff/products/` | product configuration |
| CRUD | `/api/v1/staff/taxonomy/...` | brands/models/mapping |

Exact URL naming may follow an established API convention, but semantics, authorization and errors must remain equivalent.

### 30.2 Response conventions

- JSON uses decimal strings for money/rates requiring exact representation.
- Times are ISO 8601 UTC.
- Paginated results use one consistent shape.
- Mutations return updated resource/version.
- Every error includes stable machine code, localized/user-safe message and field map where relevant.
- Include/request `X-Request-ID`; echo it in error responses and logs.
- `fields` is keyed by field name (or `non_field_errors`); each entry is a list of `{"message": string, "code": string}`, so callers get a stable per-field code alongside the human message, not just at the top level.

Example error:

```json
{
  "error": {
    "code": "listing_entitlement_required",
    "message": "You have used your free listing allowance.",
    "fields": {},
    "action": {
      "type": "PURCHASE",
      "product_code": "INDIVIDUAL_LISTING_RIGHT"
    },
    "request_id": "..."
  }
}
```

Example validation error with field-level detail:

```json
{
  "error": {
    "code": "validation_error",
    "message": "The submitted data is invalid.",
    "fields": {
      "token": [{"message": "Verification link expired.", "code": "invalid_verification_token"}]
    },
    "request_id": "..."
  }
}
```

### 30.3 Concurrency and idempotency

Require `Idempotency-Key` for Checkout creation, listing submit and staff decision requests. Store outcome for safe replay within a defined retention window. Use resource version/ETag or explicit `version` for edits.

### 30.4 Rate limits

Apply user/IP-aware limits to:

- Login/auth flows.
- Brand/model search.
- Inquiry submission.
- Message sending.
- Finance quote logging (calculation itself may remain reasonably accessible).
- Checkout creation.
- Upload intent creation.

Return 429 with retry information. Rate limiting must not store raw IP beyond approved security systems.

---

## 31. UI-to-backend traceability matrix

This matrix is mandatory review evidence. A UI item is incomplete unless the named backend source exists.

| UI element | Backend source/service | Mutation/event | Failure/empty state |
|---|---|---|---|
| Combined category tiles | `ServiceCategory` | staff catalog CRUD | hide inactive; true empty message |
| Professional result cards | `ProfessionalProfile` + `ProfessionalService` | provider/staff profile workflow | no matching professionals |
| Broker inquiry form | `InquiryService` | message + grant + notification | inline stable error code |
| Professional inquiry form | same `InquiryService` | same transaction | same component behavior |
| Boat inquiry form | same `InquiryService` | listing-context conversation | unavailable recipient state |
| Blurred phone/email | `ContactAccessService` | grant after successful inquiry | locked explanation |
| Card view count | `ListingView` aggregate | unique view insert | show 0 or omit per approved design, consistently |
| Estimated installment | `FinanceQuoteService` | explicit quote log only | entire block hidden if ineligible |
| Finance assumptions | config version + listing overrides | staff/broker save | global fallback |
| Broker finance toggle | `BoatListing.show_finance_estimate` | broker draft/revision save | absent for private seller |
| Listing CTA availability | `ListingEligibilityService` | reserve/consume entitlement | purchase CTA |
| Free-right copy/countdown | entitlement ledger + platform settings | none | exact next eligibility date |
| Product card/price | `MarketplaceProduct` + verified Stripe price | Checkout Session | unavailable/mismatch warning |
| Extra media controls | effective media policy + entitlement | consume upgrade/upload intent | purchase upgrade CTA |
| Pending approval badge | Listing/Revision state | submit/decision | never hard-coded |
| Staff pending counter | moderation queue query | state transitions | zero state |
| Other model queue | Other-model submitted listings | mapping transaction | zero state |
| Broker auto-approval | `BrokerOrganization` | audited staff update | false default |
| Notification bell | unread `Notification` count | mark read | reconnect fetch |
| Broker messages | shared conversations | message/reply/read | empty inbox |

Code review must reject any production component that substitutes hard-coded operational values for this matrix.

---

## 32. Phase 21 — Data migration, redirects and SEO

### 32.1 Migration order

1. Deploy additive schema with new nullable fields/tables.
2. Backfill brands/models and create Other placeholder per brand.
3. Map existing listing brand/model text; unresolved models map to Other with preserved custom text and review queue.
4. Backfill listing seller type and broker ownership.
5. Create initial snapshots for currently approved/published listings.
6. Backfill finance flag to `false` unless a verified approved broker setting exists; do not infer from old visual text.
7. Create service/professional canonical mappings and redirects.
8. Create default products/configuration in inactive/test-safe state, then attach real Stripe IDs per environment.
9. Backfill view count as zero unless trusted historical data exists; never convert decorative prototype counts.
10. Enable read path from new models, then write path, then remove obsolete fields in a later release.

Migrations must be resumable and log counts. Large backfills run in batches and avoid long table locks.

### 32.2 SEO

- Canonical URL for directory and professional detail.
- 301 redirects described in section 4.3.
- Update internal navigation, breadcrumbs, sitemap and hreflang for EN/IT/ES.
- Remove retired URLs from sitemap.
- Preserve six service detail pages and link them from combined directory.
- Pending/rejected/draft private listings return 404 to guests and include noindex where an authenticated private preview exists.
- Query/filter result pages follow the existing indexing policy; do not generate unlimited indexable combinations.

### 32.3 Rollback compatibility

During rollout, old code must tolerate additive fields. Do not drop old tables/columns until new release is stable, migration validated and rollback window closed.

### Definition of done

- Migration reconciliation report matches record counts and unresolved queue.
- Redirects are single-hop and canonical tags correct.
- No published listing loses public content/media.
- Prototype sample numbers are not imported as real analytics.

---

## 33. Phase 22 — Security, privacy, performance and observability

### 33.1 Security

- CSRF protection for session-authenticated mutations.
- Secure/HttpOnly/SameSite cookies and TLS only.
- Object authorization on every resource.
- Strict upload content validation; store outside executable web root.
- Escape user content; sanitize any allowed rich text.
- Allowlist local return URLs; prevent open redirects.
- Verify Stripe signatures from raw body.
- Avoid IDOR by never trusting recipient/owner IDs from client without context resolution.
- Staff high-impact actions require recent authentication if supported.
- Content Security Policy compatible with Stripe and existing asset needs.

### 33.2 Privacy

- Update privacy notice for inquiry messaging, contact unlock logs, hashed-IP view counting and payment processors.
- Obtain required consent/version on inquiry.
- Do not use browser fingerprinting.
- HMAC IP hashes are treated as pseudonymous personal data, access-restricted and never exported to sellers.
- Data subject deletion/anonymization must preserve legally/operationally required payment/audit records using documented pseudonymization.
- Email snapshots in messages follow conversation retention policy.

### 33.3 Performance targets

Reasonable initial SLOs under agreed load profile:

- Public listing/search API p95 under 500 ms excluding CDN asset download.
- Finance calculation p95 under 200 ms.
- Inquiry submission database response p95 under 800 ms excluding async email.
- WebSocket notification visible within 5 seconds after commit under normal operation.
- Avoid N+1 queries in cards/directories; verify with query-count tests.
- Paginate every unbounded staff/public collection.

### 33.4 Metrics and alerts

Track:

- Listing submissions/approvals/rejections and moderation age.
- Stripe orders paid vs fulfilled; alert on paid-not-fulfilled.
- Webhook signature failures and processing failures.
- Notification delivery failures.
- Media processing failures/queue age.
- Other-model queue age.
- Finance quote error rate.
- Unique view insert/reconciliation discrepancy.

Do not call boat sale price totals “GMV” because NAUTA does not process boat sales.

### 33.5 Logs

Structured logs include request ID, event name and safe object IDs. Never log raw card data, Stripe secrets, full webhook payload by default, message bodies, raw IP hashes/secrets or private contact values.

---

## 34. Phase 23 — Test strategy and release acceptance

### 34.1 Unit tests

- Finance formula/rounding/zero-rate/boundaries.
- Eligibility rolling-window logic and settings changes.
- Media effective limits.
- Listing/revision transitions.
- Immutable field validation.
- Contact access authorization.
- IP normalization/HMAC behavior.
- Product/entitlement state transitions.

### 34.2 Database/concurrency tests

- One free right cannot be consumed twice.
- One paid entitlement cannot attach to two listings.
- Duplicate Stripe events create one entitlement.
- Duplicate view requests create one row/count.
- Two staff decisions on one revision yield one success and one conflict.
- One Other model per brand.

Use PostgreSQL in CI for tests that depend on production constraints/locking; SQLite is insufficient.

### 34.3 API tests

- Permissions matrix for every endpoint.
- Private seller cannot enable finance.
- Guest cannot submit inquiry.
- Context recipient cannot be spoofed.
- Locked contact response contains no raw contact value.
- Pending listing is absent publicly.
- Validation/error codes are stable.
- Idempotency replay returns same result.

### 34.4 Integration tests

- Inquiry → conversation → grant → notification → email task.
- Free listing → staff approval → 30-day publication.
- Used allowance → Checkout → webhook → right available → listing submission.
- Media upgrade → entitlement binding → expanded upload limits.
- Broker auto-approval off/on workflows.
- Other model → staff notification → taxonomy mapping → new snapshot.
- Finance configuration change → card and finance page update.

### 34.5 End-to-end browser tests

At minimum desktop and mobile viewport:

1. Guest opens professional, sees locked contact, fills form, authenticates, confirms send, sees contact unlock.
2. Broker creates listing with finance off; card has no finance. Turns it on; approved/published card shows server result and new-tab calculator.
3. Private seller never sees finance toggle.
4. Private seller uses free right, attempts second listing, is blocked, purchases right in Stripe test mode and proceeds after webhook.
5. Private seller uploads one image; second image/video blocked; purchases upgrade; allowed up to limits.
6. Private seller edits published price; old price remains live until staff approval.
7. Staff sees real-time pending notification and decision queue.
8. Same viewer refreshes a listing; count remains stable.
9. Other model path works with keyboard and staff mapping.
10. Broker dashboard contains Messages and no Services & Surveyors.

### 34.6 Accessibility and visual tests

- Automated accessibility scan plus manual keyboard/screen-reader smoke test.
- Visual regression for boat card states: private, broker finance off, broker finance on, long price/model, zero views, mobile.
- Professional/broker contact locked/unlocked states.
- Staff queue empty/loading/error/populated/conflict states.

### 34.7 Required release checklist

Release may proceed only when all are true:

- [ ] Combined directory is canonical and old URLs redirect.
- [ ] Six service SEO pages still exist and are linked.
- [ ] One inquiry component/service is used everywhere and includes email.
- [ ] Raw contact data is absent from unauthorized responses/DOM.
- [ ] Contact unlock occurs only after committed valid inquiry.
- [ ] Finance default is 5%, 48 months, 20% down payment and staff-editable.
- [ ] Card and finance page use the same server calculation/version.
- [ ] Calculator opens safely in a new tab.
- [ ] Broker toggle controls finance display; private sellers cannot access it.
- [ ] View counts are unique under the defined identity rule and owner/staff/bot excluded.
- [ ] Brokers are quota-unlimited; per-broker auto-approval is staff-only.
- [ ] Individual free policy is configurable and backend-enforced.
- [ ] Used allowance blocks both UI and API and offers Checkout.
- [ ] Stripe webhook fulfillment is verified and idempotent.
- [ ] Individual immutable fields are enforced after first approval.
- [ ] Revisions preserve old public snapshot until approval.
- [ ] Private base media is 1 image/0 video; upgrade and broker limits work.
- [ ] Broker Services & Surveyors is removed and Messages works.
- [ ] Brand/model search is database-backed; Other workflow and staff notification work.
- [ ] WebSocket failure does not lose durable in-app notification.
- [ ] Emails are queued only after commit.
- [ ] All dynamic design values pass the traceability audit.
- [ ] Security, privacy, performance and observability checks pass.
- [ ] Database backup and rollback procedure are verified.

---

## 35. Phase 24 — Deployment, feature flags and rollback

### 35.1 Feature flags

Use server-side flags for controlled rollout:

```text
combined_services_professionals
unified_inquiries
contact_unlock
finance_estimates
unique_listing_views
individual_entitlements
stripe_entitlement_checkout
listing_revisions
realtime_staff_notifications
```

Flags gate both frontend exposure and backend mutation. Do not leave an enabled API behind a disabled UI unintentionally.

### 35.2 Deployment sequence

1. Back up database and verify restore procedure.
2. Deploy additive migrations.
3. Run bounded backfills and reconciliation.
4. Deploy code with features off/read-compatible.
5. Configure Stripe products/webhook in staging then production.
6. Smoke-test internal staff users.
7. Enable taxonomy and snapshot read paths.
8. Enable unified inquiries/contact access.
9. Enable finance and view counting.
10. Enable entitlements/Checkout/media upgrade.
11. Enable directory redirects/canonical sitemap.
12. Monitor errors, queues, paid-not-fulfilled metric and moderation latency.

### 35.3 Rollback

- Disable mutation feature flags first.
- Keep additive schema/data intact.
- Revert application release only if old code remains schema-compatible.
- Do not roll back a fulfilled Stripe entitlement by deleting it; preserve ledger and reconcile.
- If view recording is disabled, retain existing counts and stop new writes.
- If combined directory must be temporarily disabled, reverse proxy may route to prior page without removing canonical migration data; avoid redirect loops.

### 35.4 Post-launch checks

Within first hour/day/week:

- Verify paid orders fulfill exactly once.
- Review pending moderation queue and notification delivery.
- Compare cached view counts with unique rows.
- Check 301/canonical/sitemap crawl behavior.
- Review inquiry deliverability and contact-access failures.
- Review media failures and storage growth.

---

## 36. Detailed business rules and edge cases

### 36.1 Finance

- A zero-interest rate uses straight division and must not divide by zero.
- Price changes immediately alter finance estimate when the new version is public.
- Pending private revision price does not alter public card calculation until approved.
- Draft broker finance settings do not leak before publication.
- If global finance is disabled, listing flags remain stored but all public finance UI/API visibility is false.
- Currency symbol/format is localized; calculation uses numeric amount/currency code.
- The finance page may let user explore alternative rate/term/down payment values, but the card defaults remain server-defined and the disclaimer remains visible.

### 36.2 Views

- Changing a listing slug does not reset views because identity uses listing ID.
- Republishing the same listing after expiration does not reset lifetime unique count. A future “campaign views” metric would require a separate publication-cycle dimension and is not in scope.
- CDN/page caching must still call a controlled view-record endpoint or server event; it must not increment from card impressions.
- Known bots are excluded by explicit detection policy; uncertain clients may count and are labeled operational limitation.

### 36.3 Free and paid rights

- Configuration changes are prospective. Existing consumed entitlements preserve their recorded publication duration.
- Increasing free count allows additional uses within current rolling window; decreasing it does not revoke already consumed/published rights.
- Staff-granted right must include who, why and expiry.
- One paid listing right covers one listing publication cycle, not unlimited re-listing.
- A draft abandoned before submission releases reservation; a submitted right stays associated through changes-requested/rejected correction loop.

### 36.4 Listing moderation

- “Request changes” permits resubmission in the same entitlement/submission chain.
- A rejected-for-policy-abuse listing does not automatically refund/reissue rights.
- Staff can suspend a live listing without modifying snapshot content.
- Seller cannot delete an item under active staff review; they may withdraw submission, preserving audit.

### 36.5 Media

- Sort order change counts as revision for published private listings if it changes public presentation.
- Primary image is the first ready image by explicit order.
- A video poster does not count as an uploaded image allowance.
- Media referenced by any public snapshot cannot be physically deleted until snapshot retention permits it.

### 36.6 Contact access and abuse

- Sending empty/spam/blocked content does not create access.
- Recipient blocking a user prevents new messages and may revoke access if staff policy requires; default is to revoke contact access for that relationship.
- An entity changing public phone/email updates the revealed current business contact; the original grant remains valid unless revoked.
- Contact access is not transferable between accounts.

### 36.7 Other model

- `Other` requires an existing brand. Missing brands go to a separate support/taxonomy request; users cannot invent a brand in this release.
- Custom model text participates in semantic/full-text search.
- Mapping by staff updates future filters and card name through new approved snapshot.
- Model merge redirects taxonomy references and preserves audit/history.

---

## 37. Localization and content keys

All new UI text must have EN/IT/ES translation keys. Do not hard-code English inside JavaScript responses.

Minimum keys include:

```text
nav.services_professionals
directory.services_professionals.title
inquiry.email
inquiry.send
inquiry.sent
contact.locked_explanation
contact.unlocked
finance.estimated_payment
finance.calculate
finance.illustrative_disclaimer
listing.views
listing.finance_toggle
listing.free_allowance_used
listing.buy_right
listing.pending_approval
listing.approved_version_live
listing.immutable_field_help
media.buy_upgrade
taxonomy.other
taxonomy.enter_custom_model
staff.other_model_submitted
staff.revision_pending
broker.messages
```

Backend-generated notification/email content uses translation keys and structured parameters, not concatenated English strings.

---

## 38. Seed data and operational setup

Every environment receives migrations/commands that safely create:

- Finance defaults: 5%, 48 months, 20%.
- Individual policy: 1 free use / 365 days / 30 publication days.
- Paid policy defaults: 30 publication days / 365 unused-right validity.
- Media limits defined in section 24.
- Exactly one Other model per seeded brand.
- Two product records, inactive until valid environment Stripe IDs are supplied.
- Staff permission groups for moderation, taxonomy, product admin and full admin.

Commands are idempotent. Production setup must not include demo users, fake views, fake inquiries, decorative financial values or test Stripe IDs.

---

## 39. Developer execution protocol

This section is written to prevent partial implementation and context loss.

For each phase:

1. Read that phase and all referenced earlier model/rule sections.
2. Create/adjust migrations and domain services first.
3. Add database constraints and backend tests.
4. Implement API/HTML backend integration.
5. Implement frontend states using real responses.
6. Add permissions, audit and notifications.
7. Run phase-specific tests plus existing regression suite.
8. Update API/schema and operational documentation.
9. Demonstrate the phase definition of done with verifiable test output.
10. Only then mark the phase complete and continue.

Do not:

- Implement only the visual state.
- Leave TODO placeholders for backend enforcement.
- Fake counts, payment status, approval state or contact access.
- Grant rights from a success-page redirect.
- Hide prohibited fields only with CSS.
- Add a separate inquiry form for a new context.
- Reintroduce broker Services & Surveyors.
- Keep both Services and Professionals directories live with duplicate content.
- Preserve the historical 51-screen count by inventing pages.
- Claim completion before the release checklist and end-to-end flows pass.

### Required phase handoff note

Each phase completion must state:

- Migrations added and rollback characteristics.
- Models/services/endpoints/components changed.
- Permissions and audit events added.
- Tests added and exact results.
- Feature flag state.
- Known limitations, if any.
- Screenshots/video for changed UI states.

Any known limitation that breaks a MUST requirement prevents completion.

---

## 40. Final acceptance scenarios in Given/When/Then form

### Scenario A — Unified professional inquiry and contact unlock

**Given** a signed-in user with verified email and no grant for Professional P  
**When** the user submits a valid inquiry on P’s profile  
**Then** one conversation/message is committed, P is notified, one access grant is created, and a refetch returns P’s configured public business email/phone only to that user.

### Scenario B — Failed inquiry stays locked

**Given** the same locked state  
**When** submission fails validation, authorization or transaction commit  
**Then** no message, notification or grant exists and raw contact data is absent from the response and DOM.

### Scenario C — Broker finance card

**Given** a published broker listing priced €459,000, finance enabled, global 20% down/5%/48 months and no overrides  
**When** cards are requested  
**Then** the card returns/displays €8,456.36/month (localized rounding/display), view count and new-tab calculator CTA with disclaimer.

### Scenario D — Private finance exclusion

**Given** a private-seller listing  
**When** the owner opens create/edit or sends a crafted finance flag  
**Then** no finance control is rendered and the backend rejects/ignores prohibited finance fields according to the documented validation contract; public finance is not visible.

### Scenario E — Unique view

**Given** a published listing with zero views  
**When** an eligible anonymous IP loads it repeatedly  
**Then** one view is stored/count shown; owner, staff and bot loads add none.

### Scenario F — Broker policy

**Given** Broker B has auto-approval off  
**When** B submits a valid listing  
**Then** it is pending and hidden publicly.  
**When** staff enables auto-approval and B submits a different valid listing  
**Then** the new listing publishes, while the earlier pending item remains pending until explicit decision.

### Scenario G — Individual free right

**Given** an individual has not used a free right in the rolling period  
**When** their valid listing is submitted and approved  
**Then** the free right is consumed and publication expires after configured days.  
**When** they attempt another without paid right  
**Then** both frontend and API block creation and offer the configured product.

### Scenario H — Stripe fulfillment

**Given** the blocked individual completes Stripe Checkout  
**When** the verified paid event arrives twice  
**Then** one order becomes fulfilled and exactly one listing entitlement exists.

### Scenario I — Immutable fields and revision

**Given** an approved private listing  
**When** owner attempts to change brand/model/year  
**Then** backend rejects those fields.  
**When** owner changes price and description  
**Then** a revision is submitted, staff is notified, and old approved content stays public until approval.

### Scenario J — Media upgrade

**Given** a private listing with one image and no upgrade  
**When** owner requests another image/video upload  
**Then** backend denies with upgrade action.  
**When** paid upgrade is fulfilled and bound  
**Then** total limits become 20 images/1 video for that listing only.

### Scenario K — Other model

**Given** selected brand has no matching model  
**When** user selects Other, enters McKenzie and submits  
**Then** staff receives one notification/email, card convention is `Model: Other — McKenzie`, and Other filter includes it.  
**When** staff creates/maps canonical McKenzie model  
**Then** a new audited approved snapshot uses the canonical model.

### Scenario L — Dashboard cleanup

**Given** a broker user  
**When** dashboard navigation loads  
**Then** Messages is present with real conversation counts and Services & Surveyors is absent; its old URL redirects once to Messages.

---

## 41. External implementation references

These references support implementation patterns; this specification remains the product authority:

- [Django database transactions](https://docs.djangoproject.com/en/5.2/topics/db/transactions/) — atomic operations and post-commit callbacks.
- [Django model constraints](https://docs.djangoproject.com/en/5.2/ref/models/constraints/) — database-enforced uniqueness/check rules.
- [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment) — webhook-based reliable fulfillment.
- [Stripe webhooks](https://docs.stripe.com/webhooks) — signatures, event handling and retries.
- [Django Channels channel layers](https://channels.readthedocs.io/en/stable/topics/channel_layers.html) — production channel layer/groups.
- [Investopedia mortgage calculator](https://www.investopedia.com/mortgage-calculator-5084794) — standard fixed-payment formula reference.

---

## 42. Completion statement

The project is complete only when:

1. Every MUST rule in this document is implemented.
2. Every dynamic design value has a documented backend source.
3. All release-checklist items are checked with evidence.
4. Required automated and manual acceptance scenarios pass in staging.
5. Stripe, WebSocket, email, media and scheduled tasks are exercised end to end.
6. Production migration, monitoring and rollback are approved.

A visual demonstration alone is not completion. A backend-only implementation without the specified user states is also not completion. The unit of completion is the full, tested business flow.

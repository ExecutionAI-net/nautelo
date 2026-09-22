from decimal import Decimal

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from finance.listing_quotes import FinancePolicy, FinanceQuoteService

from .drafts import open_revision_for
from .payloads import (
    FROZEN_SPECIFICATION_KEYS,
    IMMUTABLE_FIELD_NAMES,
    SPECIFICATIONS_SCHEMA_VERSION,
    is_frozen_after_submission,
    is_locked_for_owner,
)
from .policies import effective_media_allowance, requires_staff_approval


class ListingDraftCreateSerializer(serializers.Serializer):
    """Accepts only `broker_id` plus the revision payload.

    `seller_type`, `owner_user` and `broker` are resolved on the server
    (spec §12 item 2); the payload itself is validated by
    listings.payloads.validate_revision_payload inside the service.
    """

    broker_id = serializers.UUIDField(required=False, allow_null=True)


class RevisionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    revision_number = serializers.IntegerField()
    state = serializers.CharField()
    origin = serializers.CharField()
    version = serializers.IntegerField()
    payload = serializers.JSONField()
    decision_note = serializers.CharField()
    submitted_at = serializers.DateTimeField(allow_null=True)
    decided_at = serializers.DateTimeField(allow_null=True)


class ListingWorkflowSerializer(serializers.Serializer):
    """The owner-facing representation every mutation endpoint returns.

    Spec §30.2: "Mutations return updated resource/version".
    Spec §25.1: the policy block is the server-supplied capability payload the
    Phase 16 form renders from.
    """

    def to_representation(self, listing):
        revision = getattr(listing, "open_revision", None) or open_revision_for(listing)
        allowance = effective_media_allowance(listing)
        return {
            "id": str(listing.pk),
            "status": listing.status,
            "seller_type": listing.seller_type,
            "version": listing.version,
            "published_at": listing.published_at,
            "expires_at": listing.expires_at,
            "current_public_snapshot_version": (
                listing.current_public_snapshot.version
                if listing.current_public_snapshot_id
                else None
            ),
            "revision": RevisionSerializer(revision).data if revision else None,
            "policy": {
                "requires_approval": requires_staff_approval(listing),
                "immutable_fields": _immutable_fields_for(listing),
                "image_limit": allowance.images,
                "video_limit": allowance.videos,
            },
        }


def _immutable_fields_for(listing):
    frozen = is_frozen_after_submission(listing)
    names = list(IMMUTABLE_FIELD_NAMES) if frozen or is_locked_for_owner(listing) else []
    return names + list(FROZEN_SPECIFICATION_KEYS) if frozen else names


class ListingDraftUpdateSerializer(serializers.Serializer):
    """Spec §20.5: "All edit submissions include listing/revision version."""

    version = serializers.IntegerField(min_value=1)


class ListingVersionSerializer(serializers.Serializer):
    """Body for submit/withdraw: nothing but the expected revision version."""

    version = serializers.IntegerField(min_value=1)


class RevisionDecisionSerializer(serializers.Serializer):
    """Spec §30.1's single decision endpoint, discriminated by `decision`.

    Spec §26.2: "Request changes and reject require a user-visible reason." The
    note is validated here as well as inside listings.decisions._require_note,
    on purpose: this layer turns a missing reason into a 400 with a `note` field
    error before any row is locked, while the service keeps its own check so the
    rule still holds for every non-HTTP caller (admin actions, future tasks).
    """

    APPROVE = "APPROVE"
    REQUEST_CHANGES = "REQUEST_CHANGES"
    REJECT = "REJECT"

    decision = serializers.ChoiceField(choices=[APPROVE, REQUEST_CHANGES, REJECT])
    version = serializers.IntegerField(min_value=1)
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if attrs["decision"] != self.APPROVE and not attrs.get("note", "").strip():
            raise serializers.ValidationError(
                {
                    "note": ErrorDetail(
                        "Explain what the seller needs to change.",
                        code="decision_note_required",
                    )
                }
            )
        return attrs


class StaffRevisionSerializer(serializers.Serializer):
    """The moderator-facing view of a decided revision (spec §30.2: mutations
    return the updated resource and its version).

    Deliberately narrower than ListingWorkflowSerializer: a decision response
    carries the revision's own state plus just enough listing context for the
    moderation queue to refresh, and no seller-facing policy block.
    """

    def to_representation(self, revision):
        listing = revision.listing
        return {
            "id": str(revision.pk),
            "listing_id": str(listing.pk),
            "revision_number": revision.revision_number,
            "state": revision.state,
            "origin": revision.origin,
            "version": revision.version,
            "decision_note": revision.decision_note,
            "decided_at": revision.decided_at,
            "listing": {
                "id": str(listing.pk),
                "status": listing.status,
                "version": listing.version,
                "current_public_snapshot_version": (
                    listing.current_public_snapshot.version
                    if listing.current_public_snapshot_id
                    else None
                ),
            },
        }


def _with_url(item: dict) -> dict:
    """Resolve approved snapshot media through a CDN or private S3 signed GET."""
    base = (getattr(settings, "MEDIA_PUBLIC_BASE_URL", "") or "").rstrip("/")
    key = item.get("storage_key")
    url = f"{base}/{key}" if base and key else None
    if key and not base and getattr(settings, "MEDIA_SIGNED_URLS", False):
        from django.core.files.storage import default_storage

        url = default_storage.url(key)
    return {**item, "url": url}


class PublicListingSerializer(serializers.Serializer):
    """Public representation, built ENTIRELY from the approved snapshot.

    Spec §11.4: "Public pages read from `current_public_snapshot`, not mutable
    draft fields." The only two values read off the listing row itself are
    facts *about the publication*, not about the content: `seller_type` (spec
    §29.1's private/broker badge, immutable for the owner per §20.3) and the
    publication timestamps. Everything a seller can edit comes from the
    snapshot, so a pending edit cannot reach this response — including the
    broker finance settings, which Phase 9 snapshots for exactly that reason
    (spec §36.1: "Draft broker finance settings do not leak before
    publication").

    The `finance` block is spec §18.5's, computed by finance.listing_quotes
    from the snapshot plus the live global configuration (spec §17.5). Still
    deliberately absent: CDN media URLs (spec §24 — Phase 15). That phase
    extends this serializer; it does not add a second public representation
    (spec §29.1).

    This serializer must only ever be fed rows from
    listings.views.published_listings_queryset(): it reads
    `current_public_snapshot` unconditionally and has no status gate of its own.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # One policy per serializer instance, not per row: DRF builds one
        # serializer per request and reuses a single `child` for every row of a
        # list, and FinancePolicy.load() costs two Postgres reads.
        self._finance_policy = None

    def finance_policy(self) -> FinancePolicy:
        if self._finance_policy is None:
            self._finance_policy = FinancePolicy.load()
        return self._finance_policy

    def to_representation(self, listing):
        snapshot = listing.current_public_snapshot
        return {
            "id": str(listing.pk),
            # Spec 4.1's canonical /boats/<slug>/ and 29.7's share URL.
            "slug": listing.slug,
            "seller_type": listing.seller_type,
            # Spec 29.1 "Broker identity where applicable": real fields, so a
            # client never infers the seller from display text.
            "broker": (
                {
                    "id": str(listing.broker_id),
                    "name": listing.broker.name,
                    "slug": listing.broker.slug,
                }
                if listing.broker_id
                else None
            ),
            "snapshot_version": snapshot.version,
            "published_at": listing.published_at,
            "is_featured": bool(listing.featured_until and listing.featured_until > timezone.now()),
            "expires_at": listing.expires_at,
            "brand_name": snapshot.brand_name_snapshot,
            "model_name": snapshot.model_name_snapshot,
            "custom_model_name": snapshot.custom_model_name_snapshot,
            "manufacture_year": snapshot.manufacture_year_snapshot,
            # Spec §37: EN/IT/ES side by side. No server-side locale negotiation
            # is defined anywhere in the spec and the client already knows the
            # viewer's locale (User.locale, spec §11.1), so the client picks.
            "title": {
                "en": snapshot.title_en,
                "it": snapshot.title_it,
                "es": snapshot.title_es,
            },
            "description": {
                "en": snapshot.description_en,
                "it": snapshot.description_it,
                "es": snapshot.description_es,
            },
            "specifications": snapshot.specifications,
            "specifications_schema_version": snapshot.specifications_schema_version,
            "location": {
                "country": snapshot.location_country,
                "region": snapshot.location_region,
                "city": snapshot.location_city,
                "place_id": snapshot.location_place_id,
            },
            # Spec §30.2: money as decimal strings.
            "price": {
                "amount": f"{snapshot.price:f}",
                "currency": snapshot.currency,
            },
            "media": [_with_url(item) for item in snapshot.media_manifest],
            "view_count": listing.view_count_cached,
            # Spec §18.5. Six keys when eligible, exactly {"visible": False}
            # when not — never zeros or a disabled placeholder (spec §18.2).
            "finance": FinanceQuoteService.card_block(
                listing, policy=self.finance_policy()
            ),
        }


class ListingPreviewSerializer(serializers.Serializer):
    """The owner's own listing, in PublicListingSerializer's exact SHAPE, but
    built from the current open revision's draft payload — falling back to the
    approved snapshot for any field the draft has not touched — rather than
    only ever from `current_public_snapshot`.

    Deliberately NOT a subclass of PublicListingSerializer and never fed a row
    from anywhere but `ListingPreviewView`: PublicListingSerializer's own
    docstring is explicit that it "must only ever be fed rows from
    published_listings_queryset()", precisely so a pending edit — including
    broker finance settings (spec §36.1) — can never leak onto the real public
    path. This is that same shape, deliberately walled off, for the one screen
    where showing the pending edit IS the point: the owner's own preview
    (never reachable except through IsOwnerOrBrokerEditor).

    The finance block is always `{"visible": False}` here: FinanceQuoteService
    reconciles against the live global configuration for a *committed* price,
    and a draft price is, by definition, not committed yet.
    """

    def to_representation(self, listing):
        from .snapshots import build_media_manifest

        revision = open_revision_for(listing)
        payload = dict((revision.payload if revision else None) or {})
        snapshot = listing.current_public_snapshot

        def field(key, snapshot_attr, default=""):
            return payload[key] if key in payload else getattr(snapshot, snapshot_attr, default) if snapshot else default

        specifications = payload.get("specifications")
        if specifications is None:
            specifications = snapshot.specifications if snapshot else {}
        price = payload.get("price")
        if price is None:
            price = snapshot.price if snapshot else None
        media_ids = payload.get("media_ids")
        media_manifest = (
            build_media_manifest(listing, media_ids)
            if media_ids is not None
            else (snapshot.media_manifest if snapshot else [])
        )
        return {
            "id": str(listing.pk),
            # A draft has no slug yet (spec: assigned once, at first
            # publication) — the preview route is id-keyed, never slug-keyed.
            "slug": listing.slug,
            "seller_type": listing.seller_type,
            "broker": (
                {"id": str(listing.broker_id), "name": listing.broker.name, "slug": listing.broker.slug}
                if listing.broker_id
                else None
            ),
            "snapshot_version": snapshot.version if snapshot else None,
            "published_at": listing.published_at,
            "is_featured": bool(listing.featured_until and listing.featured_until > timezone.now()),
            "expires_at": listing.expires_at,
            "brand_name": listing.brand.name,
            "model_name": listing.model.name,
            "custom_model_name": listing.custom_model_name,
            "manufacture_year": listing.manufacture_year,
            "title": {
                "en": field("title_en", "title_en"),
                "it": field("title_it", "title_it"),
                "es": field("title_es", "title_es"),
            },
            "description": {
                "en": field("description_en", "description_en"),
                "it": field("description_it", "description_it"),
                "es": field("description_es", "description_es"),
            },
            "specifications": specifications,
            "specifications_schema_version": (
                snapshot.specifications_schema_version if snapshot else SPECIFICATIONS_SCHEMA_VERSION
            ),
            "location": {
                "country": field("location_country", "location_country"),
                "region": field("location_region", "location_region"),
                "city": field("location_city", "location_city"),
                "place_id": (
                    payload["location_place_id"]
                    if "location_place_id" in payload
                    else (snapshot.location_place_id if snapshot else None)
                ),
            },
            "price": {
                "amount": f"{Decimal(price):f}" if price is not None else "0.00",
                "currency": field("currency", "currency", listing.currency),
            },
            "media": [_with_url(item) for item in media_manifest],
            "view_count": listing.view_count_cached,
            "finance": {"visible": False},
        }


class MediaIntentSerializer(serializers.Serializer):
    media_type = serializers.CharField()
    filename = serializers.CharField(max_length=255)
    mime_type = serializers.CharField(max_length=100)
    size = serializers.IntegerField(min_value=1)
    checksum_sha256 = serializers.RegexField(r"^[0-9a-f]{64}$")


class ListingMediaSerializer(serializers.Serializer):
    """The owner view of one upload. storage_key is deliberately absent."""

    id = serializers.UUIDField(read_only=True)
    media_type = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    mime_type = serializers.CharField(read_only=True)
    byte_size = serializers.IntegerField(read_only=True)
    width = serializers.IntegerField(read_only=True)
    height = serializers.IntegerField(read_only=True)
    sort_order = serializers.IntegerField(read_only=True)
    rejection_reason = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    preview_url = serializers.SerializerMethodField()

    def get_preview_url(self, obj):
        """A viewable URL for the owner's own ready images (form preview card)."""
        if obj.status != "READY":
            return None
        if obj.media_type == "VIDEO":
            from django.core.files.storage import default_storage

            from .media_video import poster_key

            if not default_storage.exists(poster_key(obj.storage_key)):
                return None
            return _with_url({"storage_key": poster_key(obj.storage_key)})["url"]
        return _with_url({"storage_key": obj.storage_key})["url"]

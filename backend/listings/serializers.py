from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from .drafts import open_revision_for
from .payloads import IMMUTABLE_FIELD_NAMES, is_locked_for_owner
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
                "immutable_fields": (
                    list(IMMUTABLE_FIELD_NAMES) if is_locked_for_owner(listing) else []
                ),
                "image_limit": allowance.images,
                "video_limit": allowance.videos,
            },
        }


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

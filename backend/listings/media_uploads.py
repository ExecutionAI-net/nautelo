"""The upload pipeline (spec §24.2): intent -> upload -> complete -> scan/process.

The allowance is judged inside a transaction that holds a row lock on the
listing, and counts EVERY non-rejected row including UPLOADING reservations
(spec §11.5), so two tabs asking at once cannot both take the last slot.
"""

import uuid
from dataclasses import dataclass
from pathlib import PurePosixPath

from django.conf import settings
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.module_loading import import_string
from rest_framework import status
from rest_framework.exceptions import APIException

from audit.models import AuditEvent
from audit.services import record_audit_event

from . import media_storage
from .enums import MediaStatus, MediaType
from .media_policy import (
    RejectedMedia,
    inspect_bytes,
    validate_declared,
)
from .models import BoatListing, ListingMedia, ListingSnapshot
from .policies import effective_media_allowance, media_counts


class MediaLimitReached(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This listing has reached its media limit."
    default_code = "media_limit_reached"

    def __init__(self, *, media_type: str, allowance):
        super().__init__(detail=self.default_detail, code=self.default_code)
        self.meta = {
            "media_type": media_type,
            "images_allowed": allowance.images,
            "videos_allowed": allowance.videos,
        }
        # Only a private seller without the upgrade can buy more.
        self.action = None


class UnsupportedMedia(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "unsupported_media"
    default_detail = "This file cannot be uploaded."

    def __init__(self, reason: str):
        super().__init__(detail=reason, code=self.default_code)


class MediaUploadIncomplete(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The uploaded file is missing or its size does not match."
    default_code = "media_upload_incomplete"


class MediaNotPending(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This upload is not waiting for completion."
    default_code = "media_not_pending"


class MediaInPublicSnapshot(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This media is part of the published listing."
    default_code = "media_in_public_snapshot"


@dataclass(frozen=True)
class UploadIntent:
    media: ListingMedia
    target: media_storage.UploadTarget


def _audit(actor, action, media, extra=None):
    actor_user = actor if getattr(actor, "is_authenticated", False) else None
    record_audit_event(
        actor_user=actor_user,
        actor_type=(
            AuditEvent.ActorType.USER
            if actor_user is not None
            else AuditEvent.ActorType.SYSTEM
        ),
        action=action,
        target_type="listings.ListingMedia",
        target_id=str(media.pk),
        source=AuditEvent.Source.API if actor_user else AuditEvent.Source.TASK,
        before=None,
        after={"status": media.status},
        metadata={"listing_id": str(media.listing_id), **(extra or {})},
    )


@transaction.atomic
def create_upload_intent(
    *,
    actor,
    listing: BoatListing,
    media_type: str,
    filename: str,
    mime_type: str,
    size: int,
    checksum_sha256: str,
) -> UploadIntent:
    try:
        validate_declared(
            media_type=media_type, filename=filename, mime_type=mime_type, size=size
        )
    except RejectedMedia as exc:
        raise UnsupportedMedia(exc.reason) from None

    # The serialisation point for the allowance check (spec §24.2 step 2).
    listing = BoatListing.objects.select_for_update().get(pk=listing.pk)
    allowance = effective_media_allowance(listing)
    images, videos = media_counts(listing)
    used, limit = (
        (images, allowance.images)
        if media_type == MediaType.IMAGE
        else (videos, allowance.videos)
    )
    if used >= limit:
        raise MediaLimitReached(media_type=media_type, allowance=allowance)

    top = ListingMedia.objects.filter(listing=listing, media_type=media_type).aggregate(
        top=Max("sort_order")
    )["top"]
    suffix = PurePosixPath(filename).suffix.lower()
    media = ListingMedia.objects.create(
        listing=listing,
        media_type=media_type,
        storage_key=f"listings/{listing.pk}/{uuid.uuid4().hex}{suffix}",
        status=MediaStatus.UPLOADING,
        mime_type=mime_type,
        byte_size=size,
        sort_order=0 if top is None else top + 1,
        checksum_sha256=checksum_sha256,
        created_by=actor,
    )
    target = media_storage.get_media_storage().upload_target(
        media.storage_key, mime_type
    )
    _audit(actor, "listing_media.intent_created", media)
    return UploadIntent(media=media, target=target)


@transaction.atomic
def complete_upload(*, actor, media: ListingMedia) -> ListingMedia:
    """Spec §24.2 step 6: validate size, then hand the file to the worker."""
    media = ListingMedia.objects.select_for_update().get(pk=media.pk)
    if media.status != MediaStatus.UPLOADING:
        raise MediaNotPending()
    actual = media_storage.get_media_storage().size(media.storage_key)
    if actual is None or actual != media.byte_size:
        raise MediaUploadIncomplete()
    media.status = MediaStatus.SCANNING
    media.save(update_fields=["status", "updated_at"])
    _audit(actor, "listing_media.upload_completed", media)
    media_id = str(media.pk)

    def _enqueue():
        from .tasks import process_listing_media

        process_listing_media.delay(media_id)

    transaction.on_commit(_enqueue)
    return media


def reject_media(media: ListingMedia, reason: str, *, actor=None) -> ListingMedia:
    media.status = MediaStatus.REJECTED
    media.rejection_reason = reason
    media.save(update_fields=["status", "rejection_reason", "updated_at"])
    media_storage.get_media_storage().delete(media.storage_key)
    _audit(actor, "listing_media.rejected", media, {"reason": reason})
    return media


def _scan(storage, key: str) -> None:
    """Malware scanning hook (spec §24.2 step 7). `settings.MEDIA_SCANNER` is a
    dotted path to `callable(storage, key)` that raises RejectedMedia on a hit.
    Unset means no scanner is deployed yet, which is a recorded limitation."""
    path = getattr(settings, "MEDIA_SCANNER", None)
    if path:
        import_string(path)(storage, key)


def process_media(media_id) -> ListingMedia | None:
    """Spec §24.2 steps 7-8. Idempotent: only a SCANNING row is worked on."""
    with transaction.atomic():
        media = ListingMedia.objects.select_for_update().filter(pk=media_id).first()
        if media is None or media.status != MediaStatus.SCANNING:
            return media
        storage = media_storage.get_media_storage()
        try:
            if storage.sha256(media.storage_key) != media.checksum_sha256:
                raise RejectedMedia("The uploaded file was corrupted in transit.")
            _scan(storage, media.storage_key)
            media.status = MediaStatus.PROCESSING
            media.save(update_fields=["status", "updated_at"])
            found = inspect_bytes(
                media_type=media.media_type,
                declared_mime=media.mime_type,
                data=storage.read_head(media.storage_key),
            )
        except RejectedMedia as exc:
            return reject_media(media, exc.reason)
        media.mime_type = found.mime_type
        media.width = found.width
        media.height = found.height
        media.status = MediaStatus.READY
        media.save(
            update_fields=["mime_type", "width", "height", "status", "updated_at"]
        )
        _audit(None, "listing_media.ready", media)
        return media


def remove_media(*, actor, media: ListingMedia) -> ListingMedia:
    """Owner removes an item. Refused when a public snapshot still shows it
    (spec §24.5: old media stay until no snapshot needs them)."""
    referenced = ListingSnapshot.objects.filter(
        listing_id=media.listing_id,
        media_manifest__contains=[{"media_id": str(media.pk)}],
    ).exists()
    if referenced:
        raise MediaInPublicSnapshot()
    return reject_media(media, "Removed by the seller.", actor=actor)


def cleanup_stale_uploads(*, now=None) -> int:
    """Spec §24.2 step 9: UPLOADING reservations older than an hour are freed."""
    now = now or timezone.now()
    cutoff = now - media_storage.stale_after()
    stale = list(
        ListingMedia.objects.filter(status=MediaStatus.UPLOADING, created_at__lt=cutoff)
    )
    for media in stale:
        reject_media(media, "The upload did not finish in time.")
    return len(stale)

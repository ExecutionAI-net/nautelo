"""Logo and cover image upload for broker and professional organizations.

Same seam as listing media (presigned PUT straight to private storage, bytes
never proxied through Django) but synchronous and tiny: the intent reserves a
key, and `complete` re-reads the object, re-encodes it (dropping EXIF/ICC/XMP),
checks its size and replaces the previous image. The row stores only the
storage key; the public serializers resolve it to a signed/CDN URL at read time.
"""

import uuid

from django.conf import settings
from rest_framework.exceptions import ValidationError

from listings import media_storage
from listings.media_policy import RejectedMedia
from listings.media_sanitize import sanitize_image

MAX_BYTES = 5 * 1024 * 1024
MIN_SIZE = {"logo": (128, 128), "cover": (600, 200)}
EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
KINDS = ("logo", "cover")


def key_prefix(owner_type: str, owner_id) -> str:
    return f"org-images/{owner_type}/{owner_id}/"


def resolve_url(key: str) -> str | None:
    """CDN URL when configured, otherwise a signed GET on the private bucket."""
    if not key:
        return None
    base = (getattr(settings, "MEDIA_PUBLIC_BASE_URL", "") or "").rstrip("/")
    if base:
        return f"{base}/{key}"
    if getattr(settings, "MEDIA_SIGNED_URLS", False):
        from django.core.files.storage import default_storage

        return default_storage.url(key)
    return None


def create_intent(*, owner_type: str, owner_id, kind: str, mime_type: str, size: int) -> dict:
    if kind not in KINDS:
        raise ValidationError({"kind": ["invalid_kind"]})
    if mime_type not in EXTENSIONS:
        raise ValidationError({"mime_type": ["unsupported_image_type"]})
    if size <= 0 or size > MAX_BYTES:
        raise ValidationError({"size": ["image_too_large"]})
    key = f"{key_prefix(owner_type, owner_id)}{kind}-{uuid.uuid4().hex}{EXTENSIONS[mime_type]}"
    target = media_storage.get_media_storage().upload_target(key, mime_type)
    return {"key": key, "url": target.url, "method": target.method, "headers": target.headers}


def finish_upload(*, owner_type: str, owner_id, kind: str, key: str, mime_type: str) -> str:
    """Validate and clean the uploaded object; returns the key to store."""
    if kind not in KINDS or not key.startswith(key_prefix(owner_type, owner_id)) or f"/{kind}-" not in key:
        raise ValidationError({"key": ["invalid_key"]})
    storage = media_storage.get_media_storage()
    size = storage.size(key)
    if size is None:
        raise ValidationError({"key": ["upload_missing"]})
    if size > MAX_BYTES:
        storage.delete(key)
        raise ValidationError({"key": ["image_too_large"]})
    try:
        cleaned = sanitize_image(storage.read(key), mime_type)
    except RejectedMedia:
        storage.delete(key)
        raise ValidationError({"key": ["unreadable_image"]}) from None
    min_w, min_h = MIN_SIZE[kind]
    if cleaned.width < min_w or cleaned.height < min_h:
        storage.delete(key)
        raise ValidationError({"key": ["image_too_small"]})
    storage.write(key, cleaned.data, mime_type)
    return key


def replace_key(storage_attr_owner, field: str, new_key: str) -> None:
    """Point `field` at `new_key` and delete the image it replaces."""
    storage = media_storage.get_media_storage()
    old = getattr(storage_attr_owner, field)
    setattr(storage_attr_owner, field, new_key)
    storage_attr_owner.save(update_fields=[field, "updated_at"])
    if old and old != new_key:
        storage.delete(old)

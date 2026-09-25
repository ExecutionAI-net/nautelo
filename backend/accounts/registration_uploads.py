"""Pre-registration file uploads: a broker's logo and verification documents.

The organization doesn't exist yet at this point in the flow, so these can't
go through `common.org_images` (which writes straight to an owner model). Keys
are namespaced by a client-generated `registration_id` (a UUID minted once per
registration attempt) instead of a real owner id; `register_organization`
attaches the finished keys to the new BrokerOrganization once it exists.

Logos reuse `common.org_images` under owner_type="org-registration" - the
same presign/sanitize/resize pipeline as a broker's post-registration logo
upload, just keyed by the registration id instead of a broker id. Documents
are a separate, simpler path: no image sanitizing (a PDF isn't an image), just
a type and size check.
"""

import uuid

from rest_framework.exceptions import ValidationError

from common import org_images
from listings import media_storage

DOCUMENT_MAX_BYTES = 10 * 1024 * 1024
DOCUMENT_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "application/pdf": ".pdf"}

REGISTRATION_OWNER_TYPE = "org-registration"


def _document_prefix(registration_id: str) -> str:
    return f"{org_images.key_prefix(REGISTRATION_OWNER_TYPE, registration_id)}document-"


def create_logo_intent(*, registration_id: str, mime_type: str, size: int) -> dict:
    return org_images.create_intent(
        owner_type=REGISTRATION_OWNER_TYPE, owner_id=registration_id, kind="logo", mime_type=mime_type, size=size
    )


def finish_logo_upload(*, registration_id: str, key: str, mime_type: str) -> str:
    return org_images.finish_upload(
        owner_type=REGISTRATION_OWNER_TYPE, owner_id=registration_id, kind="logo", key=key, mime_type=mime_type
    )


def create_document_intent(*, registration_id: str, mime_type: str, size: int) -> dict:
    if mime_type not in DOCUMENT_TYPES:
        raise ValidationError({"mime_type": ["unsupported_document_type"]})
    if size <= 0 or size > DOCUMENT_MAX_BYTES:
        raise ValidationError({"size": ["document_too_large"]})
    key = f"{_document_prefix(registration_id)}{uuid.uuid4().hex}{DOCUMENT_TYPES[mime_type]}"
    target = media_storage.get_media_storage().upload_target(key, mime_type)
    return {"key": key, "url": target.url, "method": target.method, "headers": target.headers}


def finish_document_upload(*, registration_id: str, key: str) -> str:
    if not key.startswith(_document_prefix(registration_id)):
        raise ValidationError({"key": ["invalid_key"]})
    storage = media_storage.get_media_storage()
    size = storage.size(key)
    if size is None:
        raise ValidationError({"key": ["upload_missing"]})
    if size > DOCUMENT_MAX_BYTES:
        storage.delete(key)
        raise ValidationError({"key": ["document_too_large"]})
    return key


def logo_key_is_valid(*, registration_id: str, key: str) -> bool:
    prefix = org_images.key_prefix(REGISTRATION_OWNER_TYPE, registration_id)
    return key.startswith(prefix) and "/logo-" in key and media_storage.get_media_storage().size(key) is not None


def document_key_is_valid(*, registration_id: str, key: str) -> bool:
    return key.startswith(_document_prefix(registration_id)) and media_storage.get_media_storage().size(key) is not None

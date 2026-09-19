"""The object-storage seam for listing media (spec §24.2).

Uploads go straight from the browser to PRIVATE storage through a presigned PUT;
nothing here proxies file bytes through Django. Everything the pipeline needs
from storage is these five functions, so tests swap the whole backend with
`set_media_storage()` instead of mocking boto3.
"""

import hashlib
from dataclasses import dataclass
from datetime import timedelta

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

UPLOAD_URL_TTL_SECONDS = 15 * 60
HEAD_BYTES = 64 * 1024
CHUNK = 1024 * 1024


@dataclass(frozen=True)
class UploadTarget:
    url: str
    method: str
    headers: dict
    expires_in: int


class S3MediaStorage:
    def upload_target(self, key: str, content_type: str) -> UploadTarget:
        client = default_storage.connection.meta.client
        url = client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": default_storage.bucket_name,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=UPLOAD_URL_TTL_SECONDS,
        )
        return UploadTarget(
            url=url,
            method="PUT",
            headers={"Content-Type": content_type},
            expires_in=UPLOAD_URL_TTL_SECONDS,
        )

    def size(self, key: str) -> int | None:
        if not default_storage.exists(key):
            return None
        return default_storage.size(key)

    def read_head(self, key: str, n: int = HEAD_BYTES) -> bytes:
        with default_storage.open(key, "rb") as handle:
            return handle.read(n)

    def sha256(self, key: str) -> str:
        digest = hashlib.sha256()
        with default_storage.open(key, "rb") as handle:
            for chunk in iter(lambda: handle.read(CHUNK), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def read(self, key: str) -> bytes:
        with default_storage.open(key, "rb") as handle:
            return handle.read()

    def write(self, key: str, data: bytes, content_type: str) -> None:
        default_storage.delete(key)
        default_storage.save(key, ContentFile(data))

    def delete(self, key: str) -> None:
        default_storage.delete(key)


_backend = S3MediaStorage()


def get_media_storage():
    return _backend


def set_media_storage(backend) -> None:
    global _backend
    _backend = backend


def stale_after() -> timedelta:
    """Spec §24.2 step 9: stale UPLOADING reservations are cleaned after an hour."""
    return timedelta(hours=1)

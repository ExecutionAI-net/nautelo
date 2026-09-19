"""Image sanitising (spec 24.2 step 8, spec 33 privacy).

Decodes the upload with Pillow and writes back a re-encoded copy with no
metadata: EXIF (including GPS position and camera serial), XMP and embedded
thumbnails never reach a public URL. Orientation is baked into the pixels first
so the picture does not rotate when the tag disappears. A file Pillow cannot
decode is rejected rather than served.
"""

import hashlib
import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from .media_policy import RejectedMedia

# Refuse decompression bombs well below Pillow's own 2x-limit error.
Image.MAX_IMAGE_PIXELS = 100_000_000

_FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


@dataclass(frozen=True)
class SanitizedImage:
    data: bytes
    width: int
    height: int
    sha256: str


def sanitize_image(data: bytes, mime_type: str) -> SanitizedImage:
    fmt = _FORMATS.get(mime_type)
    if fmt is None:
        raise RejectedMedia("This image type is not supported.")
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            image = ImageOps.exif_transpose(image)
            if fmt == "JPEG" and image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            out = io.BytesIO()
            options = {"quality": 90, "optimize": True} if fmt != "PNG" else {"optimize": True}
            image.save(out, format=fmt, **options)  # no exif/icc/xmp passed through
            width, height = image.size
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise RejectedMedia("The image could not be read.") from None
    cleaned = out.getvalue()
    return SanitizedImage(cleaned, width, height, hashlib.sha256(cleaned).hexdigest())


def strip_image_metadata(storage, key: str, media) -> None:
    """Pipeline hook: rewrite the stored object and update the row's facts."""
    result = sanitize_image(storage.read(key), media.mime_type)
    storage.write(key, result.data, media.mime_type)
    media.width, media.height = result.width, result.height
    media.byte_size = len(result.data)
    media.checksum_sha256 = result.sha256

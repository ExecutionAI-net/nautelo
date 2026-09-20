"""File policy for listing media (spec §24.3), in pure Python.

No image or video library is a project dependency, so inspection here reads
headers directly: the file signature (never the client's word), and for images
the pixel dimensions. Re-encoding, derivatives, metadata stripping and video
transcoding need Pillow/ffmpeg and are a recorded limitation of this phase.
"""

import struct
from dataclasses import dataclass

from .enums import MediaType

MIB = 1024 * 1024
IMAGE_MAX_BYTES = 25 * MIB
VIDEO_MAX_BYTES = 250 * MIB
VIDEO_MAX_SECONDS = 120
# Spec §24.3: "Minimum recommended resolution 1280x720; reject unusably small
# images below defined product threshold." The rejection threshold is 640x360.
IMAGE_MIN_WIDTH = 400
IMAGE_MIN_HEIGHT = 300

ALLOWED_MIME = {
    MediaType.IMAGE: {
        "image/jpeg": (".jpg", ".jpeg"),
        "image/png": (".png",),
        "image/webp": (".webp",),
    },
    MediaType.VIDEO: {
        "video/mp4": (".mp4",),
        "video/webm": (".webm",),
    },
}


@dataclass(frozen=True)
class Inspection:
    mime_type: str
    width: int | None = None
    height: int | None = None


class RejectedMedia(Exception):
    """Carries a user-safe reason (spec §24.2 step 8)."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def max_bytes(media_type: str) -> int:
    return IMAGE_MAX_BYTES if media_type == MediaType.IMAGE else VIDEO_MAX_BYTES


def validate_declared(*, media_type: str, filename: str, mime_type: str, size: int):
    """Intent-time checks on what the client CLAIMS. The bytes are re-checked by
    `inspect_bytes` once they exist."""
    allowed = ALLOWED_MIME.get(media_type)
    if allowed is None or mime_type not in allowed:
        raise RejectedMedia("This file type is not supported.")
    if not filename.lower().endswith(allowed[mime_type]):
        raise RejectedMedia("The file extension does not match its type.")
    if size <= 0 or size > max_bytes(media_type):
        raise RejectedMedia("This file is too large.")


def _png_size(head: bytes):
    if head[12:16] != b"IHDR":
        raise RejectedMedia("This image is damaged.")
    return struct.unpack(">II", head[16:24])


def _jpeg_size(data: bytes):
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        length = struct.unpack(">H", data[i + 2 : i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB):
            height, width = struct.unpack(">HH", data[i + 5 : i + 9])
            return width, height
        i += 2 + length
    raise RejectedMedia("This image is damaged.")


def _webp_size(data: bytes):
    kind = data[12:16]
    if kind == b"VP8 ":
        w, h = struct.unpack("<HH", data[26:30])
        return w & 0x3FFF, h & 0x3FFF
    if kind == b"VP8L":
        bits = struct.unpack("<I", data[21:25])[0]
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if kind == b"VP8X":
        w = int.from_bytes(data[24:27], "little") + 1
        h = int.from_bytes(data[27:30], "little") + 1
        return w, h
    raise RejectedMedia("This image is damaged.")


def sniff_mime(head: bytes) -> str | None:
    if head[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head[4:8] == b"ftyp":
        return "video/mp4"
    if head[:4] == b"\x1aE\xdf\xa3":
        return "video/webm"
    return None


def inspect_bytes(*, media_type: str, declared_mime: str, data: bytes) -> Inspection:
    """Judge the actual bytes against the declaration (spec §24.3: "Reject files
    with mismatched MIME/extension"). `data` needs only the file's first ~64 KiB
    for images (JPEG dimension markers can sit after EXIF) and 16 bytes for
    video."""
    real = sniff_mime(data[:32])
    if real is None or real != declared_mime:
        raise RejectedMedia("The file content does not match its declared type.")
    if media_type == MediaType.VIDEO:
        return Inspection(mime_type=real)
    try:
        if real == "image/png":
            width, height = _png_size(data)
        elif real == "image/jpeg":
            width, height = _jpeg_size(data)
        else:
            width, height = _webp_size(data)
    except struct.error:
        raise RejectedMedia("This image is damaged.") from None
    if width < IMAGE_MIN_WIDTH or height < IMAGE_MIN_HEIGHT:
        raise RejectedMedia(f"This image is too small (minimum {IMAGE_MIN_WIDTH} x {IMAGE_MIN_HEIGHT} pixels).")
    return Inspection(mime_type=real, width=width, height=height)

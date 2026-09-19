import struct
import zlib

import pytest

from listings.enums import MediaType
from listings.media_policy import (
    RejectedMedia,
    inspect_bytes,
    validate_declared,
)


def png(w, h):
    def chunk(kind, body):
        return (
            struct.pack(">I", len(body))
            + kind
            + body
            + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)
        )

    return b"\x89PNG\r\n\x1a\n" + chunk(
        b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    )


def jpeg(w, h):
    sof = b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, h, w, 1) + b"\x01\x11\x00"
    return b"\xff\xd8\xff\xe0" + struct.pack(">H", 4) + b"JF" + sof


def webp_vp8x(w, h):
    body = b"VP8X" + struct.pack("<I", 10) + b"\x00\x00\x00\x00"
    body += (w - 1).to_bytes(3, "little") + (h - 1).to_bytes(3, "little")
    return b"RIFF" + struct.pack("<I", len(body) + 4) + b"WEBP" + body


MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 32
WEBM = b"\x1aE\xdf\xa3" + b"\x00" * 32


def test_png_jpeg_and_webp_dimensions_are_read_from_the_bytes():
    p = inspect_bytes(
        media_type=MediaType.IMAGE, declared_mime="image/png", data=png(1920, 1080)
    )
    assert (p.width, p.height) == (1920, 1080)
    j = inspect_bytes(
        media_type=MediaType.IMAGE, declared_mime="image/jpeg", data=jpeg(1600, 900)
    )
    assert (j.width, j.height) == (1600, 900)
    w = inspect_bytes(
        media_type=MediaType.IMAGE,
        declared_mime="image/webp",
        data=webp_vp8x(1280, 720),
    )
    assert (w.width, w.height) == (1280, 720)


def test_video_signatures_are_accepted():
    mp4 = inspect_bytes(media_type=MediaType.VIDEO, declared_mime="video/mp4", data=MP4)
    assert mp4.mime_type == "video/mp4"
    webm = inspect_bytes(
        media_type=MediaType.VIDEO, declared_mime="video/webm", data=WEBM
    )
    assert webm.mime_type == "video/webm"


def test_a_declared_type_that_the_bytes_contradict_is_rejected():
    with pytest.raises(RejectedMedia):
        inspect_bytes(
            media_type=MediaType.IMAGE,
            declared_mime="image/png",
            data=jpeg(1600, 900),
        )
    with pytest.raises(RejectedMedia):
        inspect_bytes(
            media_type=MediaType.IMAGE,
            declared_mime="image/jpeg",
            data=b"GIF89a" + b"\0" * 40,
        )


def test_an_unusably_small_image_is_rejected():
    with pytest.raises(RejectedMedia, match="too small"):
        inspect_bytes(
            media_type=MediaType.IMAGE, declared_mime="image/png", data=png(320, 200)
        )


def test_a_truncated_image_is_rejected_not_crashed_on():
    with pytest.raises(RejectedMedia):
        inspect_bytes(
            media_type=MediaType.IMAGE,
            declared_mime="image/png",
            data=png(1920, 1080)[:20],
        )


def test_declared_checks_cover_type_extension_and_size():
    validate_declared(
        media_type=MediaType.IMAGE, filename="a.JPG", mime_type="image/jpeg", size=1000
    )
    bad = [
        ("image", "a.gif", "image/gif", 10),
        ("image", "a.png", "image/jpeg", 10),
        ("image", "a.jpg", "image/jpeg", 26 * 1024 * 1024),
        ("video", "a.mp4", "video/mp4", 251 * 1024 * 1024),
        ("video", "a.mp4", "video/mp4", 0),
    ]
    for kind, name, mime, size in bad:
        media_type = MediaType.IMAGE if kind == "image" else MediaType.VIDEO
        with pytest.raises(RejectedMedia):
            validate_declared(
                media_type=media_type, filename=name, mime_type=mime, size=size
            )

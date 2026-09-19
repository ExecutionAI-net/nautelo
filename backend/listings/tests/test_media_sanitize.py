import io

import pytest
from PIL import Image

from listings.media_policy import RejectedMedia
from listings.media_sanitize import sanitize_image


def _jpeg_with_exif(orientation=6, size=(64, 32)):
    image = Image.new("RGB", size, (200, 30, 30))
    exif = Image.Exif()
    exif[0x0112] = orientation  # Orientation
    exif[0x010F] = "SecretCameraCo"  # Make
    out = io.BytesIO()
    image.save(out, format="JPEG", exif=exif)
    return out.getvalue()


def test_exif_is_removed_and_orientation_baked_into_the_pixels():
    original = _jpeg_with_exif()
    assert Image.open(io.BytesIO(original)).getexif().get(0x010F) == "SecretCameraCo"

    result = sanitize_image(original, "image/jpeg")

    cleaned = Image.open(io.BytesIO(result.data))
    assert dict(cleaned.getexif()) == {}
    assert b"SecretCameraCo" not in result.data
    # Orientation 6 rotates a 64x32 picture to 32x64.
    assert (result.width, result.height) == (32, 64)


def test_png_is_reencoded_and_reports_dimensions():
    out = io.BytesIO()
    Image.new("RGBA", (10, 20)).save(out, format="PNG")
    result = sanitize_image(out.getvalue(), "image/png")
    assert (result.width, result.height) == (10, 20)
    assert len(result.sha256) == 64


@pytest.mark.parametrize("mime", ["image/jpeg", "image/gif"])
def test_undecodable_or_unsupported_files_are_rejected(mime):
    with pytest.raises(RejectedMedia):
        sanitize_image(b"not an image at all", mime)

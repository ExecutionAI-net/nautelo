import pytest

from listings.media_policy import RejectedMedia
from listings.media_video import MAX_SECONDS, parse_probe


def test_parse_probe_accepts_a_short_video():
    payload = {"streams": [{"codec_type": "video", "width": 1920, "height": 1080}], "format": {"duration": "45.2"}}
    assert parse_probe(payload) == (45.2, 1920, 1080)


@pytest.mark.parametrize(
    "payload",
    [
        {"streams": [{"codec_type": "audio"}], "format": {"duration": "10"}},
        {"streams": [{"codec_type": "video"}], "format": {"duration": str(MAX_SECONDS + 1)}},
        {"streams": [{"codec_type": "video"}], "format": {}},
    ],
)
def test_parse_probe_rejects_bad_videos(payload):
    with pytest.raises(RejectedMedia):
        parse_probe(payload)

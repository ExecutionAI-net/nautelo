import json
import subprocess

from listings import media_video


class FakeStorage:
    def __init__(self):
        self.written = {}

    def read(self, key):
        return b"video-bytes"

    def write(self, key, data, content_type):
        self.written[key] = (data, content_type)


class Media:
    width = height = None


def fake_run(cmd, **kwargs):
    if cmd[0] == "ffprobe":
        payload = {"streams": [{"codec_type": "video", "width": 1280, "height": 720}], "format": {"duration": "12"}}
        return subprocess.CompletedProcess(cmd, 0, json.dumps(payload).encode(), b"")
    return subprocess.CompletedProcess(cmd, 0, b"JPEGDATA", b"")


def test_probe_stores_a_poster_frame_next_to_the_video(monkeypatch):
    monkeypatch.setattr(media_video.subprocess, "run", fake_run)
    storage, media = FakeStorage(), Media()
    media_video.probe_video(storage, "listings/1/abc", media)
    assert (media.width, media.height) == (1280, 720)
    assert storage.written["listings/1/abc.poster.jpg"] == (b"JPEGDATA", "image/jpeg")


def test_a_failing_poster_never_rejects_the_video(monkeypatch):
    def run(cmd, **kwargs):
        if cmd[0] == "ffmpeg":
            return subprocess.CompletedProcess(cmd, 1, b"", b"boom")
        return fake_run(cmd, **kwargs)

    monkeypatch.setattr(media_video.subprocess, "run", run)
    storage = FakeStorage()
    media_video.probe_video(storage, "k", Media())
    assert storage.written == {}

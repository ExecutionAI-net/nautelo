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


def test_non_web_codecs_are_transcoded_to_h264_mp4(monkeypatch, tmp_path):
    def run(cmd, **kwargs):
        if cmd[0] == "ffprobe":
            payload = {"streams": [{"codec_type": "video", "codec_name": "hevc", "width": 1920, "height": 1080}], "format": {"duration": "9"}}
            return subprocess.CompletedProcess(cmd, 0, json.dumps(payload).encode(), b"")
        if "libx264" in cmd:
            with open(cmd[-1], "wb") as out:
                out.write(b"MP4DATA")
            return subprocess.CompletedProcess(cmd, 0, b"", b"")
        return subprocess.CompletedProcess(cmd, 0, b"JPEGDATA", b"")

    monkeypatch.setattr(media_video.subprocess, "run", run)
    storage, media = FakeStorage(), Media()
    media.mime_type = "video/quicktime"
    media_video.probe_video(storage, "k", media)
    assert storage.written["k"] == (b"MP4DATA", "video/mp4")
    assert (media.mime_type, media.byte_size) == ("video/mp4", 7)
    assert len(media.checksum_sha256) == 64


def test_h264_mp4_is_left_untouched():
    info = {"streams": [{"codec_type": "video", "codec_name": "h264"}]}
    assert media_video.needs_transcode(info, "video/mp4") is False
    assert media_video.needs_transcode(info, "video/quicktime") is True

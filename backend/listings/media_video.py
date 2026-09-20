"""Video inspection with ffprobe (spec §24.3): a real video stream, at most 120 s.

The upload is copied to a temporary file because ffprobe needs a seekable input.
A missing ffprobe binary raises RuntimeError (a deployment fault the task
retries) rather than rejecting the seller's file.
"""

import hashlib
import json
import os
import subprocess
import tempfile

from .media_policy import RejectedMedia

MAX_SECONDS = 120
PROBE_TIMEOUT = 60
TRANSCODE_TIMEOUT = 600
WEB_CODECS = {"h264"}


def parse_probe(payload: dict) -> tuple[float, int | None, int | None]:
    streams = [s for s in payload.get("streams", []) if s.get("codec_type") == "video"]
    if not streams:
        raise RejectedMedia("The file does not contain a video stream.")
    try:
        duration = float(payload.get("format", {}).get("duration") or streams[0].get("duration") or 0)
    except (TypeError, ValueError):
        raise RejectedMedia("The video length could not be read.") from None
    if duration <= 0:
        raise RejectedMedia("The video length could not be read.")
    if duration > MAX_SECONDS:
        raise RejectedMedia("Videos can be at most 120 seconds long.")
    return duration, streams[0].get("width"), streams[0].get("height")


def probe_video(storage, key: str, media) -> None:
    with tempfile.NamedTemporaryFile(suffix=".bin") as handle:
        handle.write(storage.read(key))
        handle.flush()
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", handle.name],
                capture_output=True,
                timeout=PROBE_TIMEOUT,
                check=False,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("ffprobe is not installed") from exc
        except subprocess.TimeoutExpired:
            raise RejectedMedia("The video could not be processed.") from None
        if result.returncode != 0:
            raise RejectedMedia("The video could not be processed.")
        info = json.loads(result.stdout or b"{}")
        duration, width, height = parse_probe(info)
        media.width, media.height = width, height
        if needs_transcode(info, getattr(media, "mime_type", "video/mp4")):
            _transcode(storage, key, handle.name, media)
        _write_poster(storage, key, handle.name, duration)


def poster_key(key: str) -> str:
    return f"{key}.poster.jpg"


def _write_poster(storage, key: str, path: str, duration: float) -> None:
    """Best effort: one JPEG frame for the owner preview; a failure never rejects the video."""
    try:
        frame = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", f"{min(1.0, duration / 2):.2f}", "-i", path,
             "-frames:v", "1", "-vf", "scale=640:-2", "-f", "image2", "-vcodec", "mjpeg", "pipe:1"],
            capture_output=True,
            timeout=PROBE_TIMEOUT,
            check=False,
        )
        if frame.returncode == 0 and frame.stdout:
            storage.write(poster_key(key), frame.stdout, "image/jpeg")
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass


def needs_transcode(info: dict, mime_type: str) -> bool:
    """True when the video is not already H.264 in an MP4 container (what every browser plays)."""
    streams = [s for s in info.get("streams", []) if s.get("codec_type") == "video"]
    codec = streams[0].get("codec_name") if streams else None
    return mime_type != "video/mp4" or (codec is not None and codec not in WEB_CODECS)


def _transcode(storage, key: str, path: str, media) -> None:
    """Re-encode to H.264/AAC MP4 and replace the stored object; on any failure the original stays."""
    out = path + ".web.mp4"
    try:
        done = subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", path, "-c:v", "libx264", "-preset", "veryfast",
             "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
             "-movflags", "+faststart", out],
            capture_output=True,
            timeout=TRANSCODE_TIMEOUT,
            check=False,
        )
        if done.returncode != 0 or not os.path.exists(out):
            return
        with open(out, "rb") as handle:
            data = handle.read()
        if not data:
            return
        storage.write(key, data, "video/mp4")
        media.mime_type = "video/mp4"
        media.byte_size = len(data)
        media.checksum_sha256 = hashlib.sha256(data).hexdigest()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    finally:
        if os.path.exists(out):
            os.remove(out)

import socket
import struct
import threading

import pytest

from listings.media_policy import RejectedMedia
from listings.media_scan import ScannerUnavailable, clamd_scan, scan_stream
from listings.media_video import MAX_SECONDS, parse_probe


def fake_clamd(verdict: bytes):
    server = socket.socket()
    server.bind(("127.0.0.1", 0))
    server.listen(1)
    received = bytearray()

    def serve():
        conn, _ = server.accept()
        with conn:
            buf = b""
            while not buf.endswith(b"\x00\x00\x00\x00"):
                part = conn.recv(65536)
                if not part:
                    break
                buf += part
            received.extend(buf)
            conn.sendall(verdict)
        server.close()

    threading.Thread(target=serve, daemon=True).start()
    return server.getsockname()[1], received


class Storage:
    def read(self, key):
        return b"x" * 200_000


def test_scan_stream_frames_chunks_and_returns_the_verdict():
    port, received = fake_clamd(b"stream: OK\0")
    assert scan_stream([b"abc"], host="127.0.0.1", port=port) == "stream: OK"
    assert received.startswith(b"zINSTREAM\0" + struct.pack("!I", 3) + b"abc")


def test_a_hit_rejects_the_upload(settings):
    port, _ = fake_clamd(b"stream: Eicar-Test-Signature FOUND\0")
    settings.CLAMAV_HOST, settings.CLAMAV_PORT = "127.0.0.1", port
    with pytest.raises(RejectedMedia):
        clamd_scan(Storage(), "k")


def test_a_clean_file_passes(settings):
    port, _ = fake_clamd(b"stream: OK\0")
    settings.CLAMAV_HOST, settings.CLAMAV_PORT = "127.0.0.1", port
    clamd_scan(Storage(), "k")


def test_an_unreachable_scanner_is_retried_not_rejected(settings):
    probe = socket.socket()
    probe.bind(("127.0.0.1", 0))
    port = probe.getsockname()[1]
    probe.close()
    settings.CLAMAV_HOST, settings.CLAMAV_PORT = "127.0.0.1", port
    with pytest.raises(ScannerUnavailable):
        clamd_scan(Storage(), "k")


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


def test_scan_uses_configured_timeout(settings, monkeypatch):
    settings.CLAMAV_HOST = "clamav"
    settings.CLAMAV_PORT = 3310
    settings.CLAMAV_TIMEOUT = 420.0
    calls = []

    def scan(chunks, **kwargs):
        calls.append(kwargs)
        assert b"".join(chunks) == Storage().read("k")
        return "stream: OK"

    monkeypatch.setattr("listings.media_scan.scan_stream", scan)
    clamd_scan(Storage(), "k")
    assert calls == [{"host": "clamav", "port": 3310, "timeout": 420.0}]


def test_socket_timeout_remains_retryable(monkeypatch):
    def connect(*args, **kwargs):
        raise socket.timeout("timed out")

    monkeypatch.setattr(socket, "create_connection", connect)
    with pytest.raises(ScannerUnavailable, match="timed out"):
        scan_stream([b"abc"], host="clamav", port=3310)

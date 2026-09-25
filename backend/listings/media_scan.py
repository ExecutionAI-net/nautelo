"""ClamAV malware scan (spec §24.2 step 7) over the clamd INSTREAM protocol.

A hit rejects the upload with a user-safe reason. A scanner that cannot be
reached raises ScannerUnavailable instead: the row stays SCANNING and the
Celery task retries, so an outage never lets an unscanned file through and
never wrongly rejects a clean one.
"""

import socket
import struct

from django.conf import settings

from .media_policy import RejectedMedia

CHUNK = 64 * 1024


class ScannerUnavailable(RuntimeError):
    pass


def _reply(sock: socket.socket) -> str:
    data = b""
    while not data.endswith(b"\0") and not data.endswith(b"\n"):
        part = sock.recv(4096)
        if not part:
            break
        data += part
    return data.decode("utf-8", "replace").strip("\0\n ")


def scan_stream(chunks, *, host: str, port: int, timeout: float = 30.0) -> str:
    """Return clamd's verdict line for an iterable of byte chunks."""
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.sendall(b"zINSTREAM\0")
            for chunk in chunks:
                sock.sendall(struct.pack("!I", len(chunk)) + chunk)
            sock.sendall(struct.pack("!I", 0))
            return _reply(sock)
    except OSError as exc:
        raise ScannerUnavailable(str(exc)) from exc


def ping_clamd(*, timeout: float = 2.0) -> bool:
    """True when clamd answers PING with PONG; used by the health endpoint."""
    try:
        with socket.create_connection((settings.CLAMAV_HOST, settings.CLAMAV_PORT), timeout=timeout) as sock:
            sock.sendall(b"zPING\0")
            return _reply(sock).endswith("PONG")
    except OSError:
        return False


def clamd_scan(storage, key: str) -> None:
    data = storage.read(key)
    verdict = scan_stream(
        (data[i : i + CHUNK] for i in range(0, len(data), CHUNK)),
        host=settings.CLAMAV_HOST,
        port=settings.CLAMAV_PORT,
    )
    if verdict.endswith("FOUND"):
        raise RejectedMedia("The file failed the security scan.")
    if not verdict.endswith("OK"):
        raise ScannerUnavailable(f"unexpected clamd reply: {verdict!r}")

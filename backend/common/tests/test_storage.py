import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage


def test_default_storage_round_trip():
    path = default_storage.save("healthcheck/test.txt", ContentFile(b"nautelo"))
    try:
        assert default_storage.exists(path)
        with default_storage.open(path) as f:
            assert f.read() == b"nautelo"
    finally:
        default_storage.delete(path)

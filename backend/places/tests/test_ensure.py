import pytest
from django.core.management import call_command

from places.importer import load_cities

pytestmark = pytest.mark.django_db


def test_queues_only_when_empty(monkeypatch):
    calls = []
    monkeypatch.setattr("places.tasks.sync_places.apply_async", lambda **kw: calls.append(kw))
    call_command("ensure_places")
    assert len(calls) == 1
    load_cities(["1\tX\tX\t\t1\t1\tP\tPPL\tIT\t\t01\t\t\t\t5\t\t1\tUTC\t2024-01-01\n"], {"IT"}, {})
    call_command("ensure_places")
    assert len(calls) == 1

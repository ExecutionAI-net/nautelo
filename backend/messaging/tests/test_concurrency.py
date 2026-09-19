"""Spec 34.2's database/concurrency requirement, against real PostgreSQL.

ONE module, ONE test, on purpose. `@pytest.mark.django_db(transaction=True)`
ends in a `flush` that truncates every table and does not restore rows inserted
by RunPython data migrations, so a transactional test is a global event in a
pytest session, not a local one. Keeping it alone makes that visible, and
messaging/tests/conftest.py's autouse fixture re-seeds this package's reference
rows before every test so nothing here is load-bearing on a migration seed.
"""

import threading

import pytest
from django.db import connection

from accounts.tests.factories import make_user
from messaging.enums import CURRENT_PRIVACY_POLICY_VERSION
from messaging.models import ContactAccessGrant, Conversation, Message
from messaging.services import submit_inquiry
from professionals.tests.factories import make_professional


@pytest.mark.django_db(transaction=True)
def test_concurrent_duplicate_submissions_create_exactly_one_grant():
    """Spec 16: "A successful transaction creates exactly one grant despite
    concurrent duplicate requests."

    Two threads, two connections. Whichever loses the race on either partial
    unique index recovers through the savepoint in
    _get_or_create_open_conversation / grant_contact_access rather than failing,
    so BOTH submissions succeed and land in the same thread - which is the
    correct behaviour for a message. What must NOT happen is two conversations
    or two active grants.
    """
    asker = make_user(email="race-asker@phase6.example")
    owner = make_user(email="race-owner@phase6.example")
    professional = make_professional(
        owner, display_name="Phase6 Race Pro", slug="phase6-race-pro"
    )
    outcomes: list[str] = []

    def attempt(body):
        try:
            submit_inquiry(
                actor=asker,
                context_type="PROFESSIONAL",
                context_id=professional.pk,
                full_name="Ada Rossi",
                phone="",
                subject="Race",
                body=body,
                privacy_policy_version=CURRENT_PRIVACY_POLICY_VERSION,
            )
            outcomes.append("ok")
        except Exception as exc:  # noqa: BLE001 - recorded, then asserted on
            outcomes.append(type(exc).__name__)
        finally:
            connection.close()

    threads = [
        threading.Thread(target=attempt, args=(f"Concurrent body number {index}.",))
        for index in range(2)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert outcomes == ["ok", "ok"], outcomes
    assert Conversation.objects.filter(initiator=asker).count() == 1
    assert Message.objects.count() == 2
    assert (
        ContactAccessGrant.objects.filter(
            viewer=asker, revoked_at__isnull=True
        ).count()
        == 1
    )

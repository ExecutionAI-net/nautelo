import pytest
from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.services import set_broker_auto_approval
from brokers.tests.factories import make_broker


@pytest.mark.django_db
def test_enabling_auto_approval_stamps_the_actor_and_time():
    actor = make_user("admin@example.com", role=UserRole.STAFF)
    broker = make_broker()
    before = timezone.now()

    result = set_broker_auto_approval(
        broker, enabled=True, actor=actor, reason="Vetted partner."
    )

    assert result.changed is True
    assert result.broker.auto_approve_listings is True
    assert result.broker.auto_approve_changed_by == actor
    assert result.broker.auto_approve_changed_at >= before


@pytest.mark.django_db
def test_setting_the_same_value_does_not_restamp():
    actor = make_user("admin2@example.com", role=UserRole.STAFF)
    broker = make_broker()
    set_broker_auto_approval(broker, enabled=True, actor=actor, reason="Vetted partner.")
    first_stamp = broker.auto_approve_changed_at

    set_broker_auto_approval(broker, enabled=True, actor=actor, reason="Vetted partner.")

    broker.refresh_from_db()
    assert broker.auto_approve_changed_at == first_stamp


@pytest.mark.django_db
def test_disabling_auto_approval_restamps():
    actor = make_user("admin3@example.com", role=UserRole.STAFF)
    broker = make_broker()
    set_broker_auto_approval(broker, enabled=True, actor=actor, reason="Vetted partner.")
    enabled_at = broker.auto_approve_changed_at

    set_broker_auto_approval(broker, enabled=False, actor=actor, reason="Rolled back.")

    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert broker.auto_approve_changed_at > enabled_at

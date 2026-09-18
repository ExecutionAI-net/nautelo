import pytest

from audit.models import AuditEvent
from platform_settings.services import is_feature_enabled, set_feature_flag


@pytest.mark.django_db
def test_is_feature_enabled_returns_the_given_default_when_flag_does_not_exist():
    assert is_feature_enabled("example_flag") is False
    assert is_feature_enabled("example_flag", default=True) is True


@pytest.mark.django_db
def test_set_feature_flag_creates_a_new_flag_and_records_an_audit_event(staff_user):
    flag = set_feature_flag(
        key="example_flag",
        is_enabled=True,
        actor=staff_user,
        description="Gates the finance card estimate (Phase 9).",
    )

    assert flag.is_enabled is True
    assert is_feature_enabled("example_flag") is True

    event = AuditEvent.objects.get(target_id="example_flag")
    assert event.action == "feature_flag.created"
    assert event.before == {"is_enabled": None}
    assert event.after == {"is_enabled": True}


@pytest.mark.django_db
def test_set_feature_flag_toggles_an_existing_flag_and_records_before_after(staff_user):
    set_feature_flag(key="example_flag", is_enabled=True, actor=staff_user)

    set_feature_flag(key="example_flag", is_enabled=False, actor=staff_user)

    event = AuditEvent.objects.filter(target_id="example_flag").latest("created_at")
    assert event.action == "feature_flag.updated"
    assert event.before == {"is_enabled": True}
    assert event.after == {"is_enabled": False}


@pytest.mark.django_db
def test_is_feature_enabled_is_served_from_cache_after_first_lookup(
    staff_user, django_assert_num_queries
):
    set_feature_flag(key="example_flag", is_enabled=True, actor=staff_user)
    is_feature_enabled("example_flag")  # warms the cache

    with django_assert_num_queries(0):
        assert is_feature_enabled("example_flag") is True

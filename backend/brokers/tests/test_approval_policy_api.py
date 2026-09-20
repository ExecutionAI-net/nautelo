"""Spec §30.1's PATCH /api/v1/staff/brokers/<id>/approval-policy/ and spec §21
rule 4: "Only staff admin may toggle policy; change requires a reason."
"""

import pytest
from django.contrib.auth.models import Group
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from brokers.enums import BrokerMembershipRole
from brokers.services import POLICY_REASON_REQUIRED_MESSAGE
from brokers.tests.factories import make_broker, make_membership
from platform_settings.services import set_feature_flag


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


def _staff(email, group_name):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    user.groups.add(Group.objects.get(name=group_name))
    return user


def _url(broker):
    return reverse("staff-broker-approval-policy", args=[broker.pk])


@pytest.mark.django_db
def test_a_staff_admin_enables_the_policy_and_gets_the_refreshed_detail(
    api, workflow_enabled
):
    admin = _staff("policy-api-admin@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Toggle Me", slug="toggle-me")
    api.force_authenticate(admin)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "Vetted partner, 8 years."},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["changed"] is True
    assert response.data["auto_approve_listings"] is True
    assert response.data["auto_approve_changed_by"]["email"] == admin.email
    assert response.data["auto_approve_changed_at"] is not None
    # Spec §30.2: a mutation returns the updated resource — including the audit
    # row it just wrote, so the screen needs no second request.
    assert response.data["audit_history"][0]["action"] == "broker.auto_approval_changed"
    assert response.data["audit_history"][0]["reason"] == "Vetted partner, 8 years."
    broker.refresh_from_db()
    assert broker.auto_approve_listings is True


@pytest.mark.django_db
def test_a_staff_admin_disables_the_policy(api, workflow_enabled):
    admin = _staff("policy-api-off@example.com", StaffGroup.ADMIN)
    broker = make_broker(
        name="Turn Off", slug="turn-off", auto_approve_listings=True
    )
    api.force_authenticate(admin)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": False, "reason": "Two rejected listings."},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["auto_approve_listings"] is False
    assert response.data["changed"] is True


@pytest.mark.django_db
def test_setting_the_value_it_already_has_reports_no_change_and_audits_nothing(
    api, workflow_enabled
):
    admin = _staff("policy-api-noop@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Already Off", slug="already-off")
    api.force_authenticate(admin)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": False, "reason": "Confirming current state."},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["changed"] is False
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize("body", [{"auto_approve_listings": True}, {"auto_approve_listings": True, "reason": "   "}])
def test_a_change_without_a_reason_is_refused(api, workflow_enabled, body):
    """Spec §21 rule 4: "change requires a reason"."""
    admin = _staff("policy-api-noreason@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="No Reason API", slug="no-reason-api")
    api.force_authenticate(admin)

    response = api.patch(_url(broker), body, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "reason" in response.data["error"]["fields"]
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False


@pytest.mark.django_db
def test_the_flag_is_required(api, workflow_enabled):
    admin = _staff("policy-api-noflag@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="No Flag", slug="no-flag")
    api.force_authenticate(admin)

    response = api.patch(_url(broker), {"reason": "Because."}, format="json")

    assert response.status_code == 400
    assert "auto_approve_listings" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_a_staff_moderator_cannot_toggle_the_policy(api, workflow_enabled):
    """Spec §5: "Configure broker auto-approval" is staff admin only."""
    moderator = _staff("policy-api-mod@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="Mod Guard", slug="mod-guard")
    api.force_authenticate(moderator)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "Trying it on."},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "staff_admin_required"
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False


@pytest.mark.django_db
def test_a_broker_admin_cannot_toggle_their_own_organizations_policy(
    api, workflow_enabled
):
    """Spec §21 acceptance test 2, API half; spec §11.1 "Broker users may see
    the current policy but cannot change it."""
    broker = make_broker(name="Self Serve", slug="self-serve")
    user = make_user("policy-api-broker@example.com", role=UserRole.BROKER, verified=True)
    make_membership(
        user,
        broker,
        role=BrokerMembershipRole.ADMIN,
        can_edit_listings=True,
        can_manage_team=True,
        can_read_messages=True,
    )
    api.force_authenticate(user)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "I would like this on."},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "staff_admin_required"
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
def test_an_anonymous_caller_cannot_toggle_the_policy(api, workflow_enabled):
    broker = make_broker(name="Anon Policy", slug="anon-policy")

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "No."},
        format="json",
    )

    assert response.status_code in (401, 403)
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False


@pytest.mark.django_db
def test_the_endpoint_is_gated_on_the_listing_revisions_flag(api, db):
    """Spec §35.1: flags gate backend mutation, not just UI."""
    set_feature_flag(key="listing_revisions", is_enabled=False, actor=None)
    admin = _staff("policy-api-flag@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Flagged", slug="flagged")
    api.force_authenticate(admin)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "Too early."},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"


@pytest.mark.django_db
def test_an_unknown_broker_is_a_404(api, workflow_enabled):
    import uuid

    admin = _staff("policy-api-404@example.com", StaffGroup.ADMIN)
    api.force_authenticate(admin)

    response = api.patch(
        reverse("staff-broker-approval-policy", args=[uuid.uuid4()]),
        {"auto_approve_listings": True, "reason": "Nobody home."},
        format="json",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_an_anonymous_caller_gets_401_and_nothing_changes(api, workflow_enabled):
    broker = make_broker(name="Anon 401", slug="anon-401")

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "No."},
        format="json",
    )

    assert response.status_code == 401
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


def _assert_denied_and_untouched(response, broker, code="staff_admin_required"):
    assert response.status_code == 403
    assert response.data["error"]["code"] == code
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert broker.auto_approve_changed_by_id is None
    assert broker.auto_approve_changed_at is None
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


def _try_toggle(api, user, broker):
    api.force_authenticate(user)
    return api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "Trying it on."},
        format="json",
    )


@pytest.mark.django_db
def test_an_authenticated_buyer_is_denied(api, workflow_enabled):
    broker = make_broker(name="Buyer Guard", slug="buyer-guard")
    user = make_user("policy-api-buyer@example.com", role=UserRole.PRIVATE_SELLER, verified=True)
    _assert_denied_and_untouched(_try_toggle(api, user, broker), broker)


@pytest.mark.django_db
def test_a_private_seller_is_denied(api, workflow_enabled):
    broker = make_broker(name="Seller Guard", slug="seller-guard")
    user = make_user(
        "policy-api-seller@example.com", role=UserRole.PRIVATE_SELLER, verified=True
    )
    _assert_denied_and_untouched(_try_toggle(api, user, broker), broker)


@pytest.mark.django_db
def test_a_member_of_another_broker_is_denied(api, workflow_enabled):
    target = make_broker(name="Target Org", slug="target-org")
    other = make_broker(name="Other Org", slug="other-org")
    user = make_user("policy-api-other@example.com", role=UserRole.BROKER, verified=True)
    make_membership(
        user,
        other,
        role=BrokerMembershipRole.ADMIN,
        can_edit_listings=True,
        can_manage_team=True,
        can_read_messages=True,
    )
    _assert_denied_and_untouched(_try_toggle(api, user, target), target)
    other.refresh_from_db()
    assert other.auto_approve_listings is False


@pytest.mark.django_db
def test_a_broker_agent_of_this_broker_is_denied(api, workflow_enabled):
    broker = make_broker(name="Agent Guard", slug="agent-guard")
    user = make_user("policy-api-agent@example.com", role=UserRole.BROKER, verified=True)
    make_membership(user, broker, role=BrokerMembershipRole.AGENT)
    _assert_denied_and_untouched(_try_toggle(api, user, broker), broker)


@pytest.mark.django_db
def test_a_moderator_denial_leaves_no_stamp_or_audit_row(api, workflow_enabled):
    moderator = _staff("policy-api-mod2@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="Mod Stamp", slug="mod-stamp")
    _assert_denied_and_untouched(_try_toggle(api, moderator, broker), broker)


@pytest.mark.django_db
def test_an_inactive_staff_admin_cannot_toggle(api, workflow_enabled):
    admin = _staff("policy-api-inactive@example.com", StaffGroup.ADMIN)
    admin.is_active = False
    admin.save(update_fields=["is_active"])
    broker = make_broker(name="Inactive Admin", slug="inactive-admin")
    api.force_authenticate(admin)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "Should not work."},
        format="json",
    )

    assert response.status_code in (401, 403)
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
def test_the_flag_gate_leaves_no_stamp_or_audit_row(api, db):
    set_feature_flag(key="listing_revisions", is_enabled=False, actor=None)
    admin = _staff("policy-api-flag2@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Flag Stamp", slug="flag-stamp")
    _assert_denied_and_untouched(
        _try_toggle(api, admin, broker), broker, code="feature_disabled"
    )


@pytest.mark.django_db
@pytest.mark.parametrize("reason", ["x", "x" * 500])
def test_reasons_up_to_500_characters_are_accepted_and_trimmed(
    api, workflow_enabled, reason
):
    admin = _staff("policy-api-len-ok@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Len Ok", slug="len-ok")
    api.force_authenticate(admin)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": f"  {reason}  "},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["audit_history"][0]["reason"] == reason


@pytest.mark.django_db
def test_a_501_character_reason_is_refused_and_changes_nothing(api, workflow_enabled):
    admin = _staff("policy-api-len-bad@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Len Bad", slug="len-bad")
    api.force_authenticate(admin)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "x" * 501},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "reason" in response.data["error"]["fields"]
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
def test_a_missing_or_blank_reason_reaches_the_client_with_the_shared_message(
    api, workflow_enabled
):
    admin = _staff("policy-api-msg@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Msg", slug="msg")
    api.force_authenticate(admin)

    for body in (
        {"auto_approve_listings": True},
        {"auto_approve_listings": True, "reason": "   "},
        {"auto_approve_listings": True, "reason": ""},
    ):
        response = api.patch(_url(broker), body, format="json")
        assert response.status_code == 400
        assert response.data["error"]["fields"]["reason"] == [
            {"message": POLICY_REASON_REQUIRED_MESSAGE, "code": "policy_reason_required"}
        ]


@pytest.mark.django_db
def test_a_no_op_with_a_blank_reason_is_still_refused(api, workflow_enabled):
    """The reason is required for every request, even one that would change nothing."""
    admin = _staff("policy-api-noop2@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Noop Blank", slug="noop-blank")
    api.force_authenticate(admin)

    response = api.patch(
        _url(broker), {"auto_approve_listings": False, "reason": " "}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize(
    "body, field",
    [
        ({"auto_approve_listings": "maybe", "reason": "Because."}, "auto_approve_listings"),
        ({"auto_approve_listings": None, "reason": "Because."}, "auto_approve_listings"),
        ({"auto_approve_listings": True, "reason": None}, "reason"),
        ({"auto_approve_listings": True, "reason": ["a"]}, "reason"),
        ({"auto_approve_listings": True, "reason": {"a": 1}}, "reason"),
    ],
)
def test_wrong_types_are_refused_without_changing_anything(
    api, workflow_enabled, body, field
):
    admin = _staff("policy-api-types@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Types", slug="types")
    api.force_authenticate(admin)

    response = api.patch(_url(broker), body, format="json")

    assert response.status_code == 400
    assert field in response.data["error"]["fields"]
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
def test_the_response_matches_the_detail_endpoint_plus_changed(api, workflow_enabled):
    admin = _staff("policy-api-shape@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Shape", slug="shape")
    api.force_authenticate(admin)

    patched = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "Shape check."},
        format="json",
    )
    detail = api.get(reverse("staff-broker-detail", args=[broker.pk]))

    body = dict(patched.data)
    assert body.pop("changed") is True
    assert body == detail.data


@pytest.mark.django_db
def test_the_response_does_not_run_a_query_storm(api, workflow_enabled):
    admin = _staff("policy-api-queries@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Queries", slug="queries")
    api.force_authenticate(admin)
    api.patch(  # warm caches (feature flag, permissions)
        _url(broker),
        {"auto_approve_listings": True, "reason": "Warm."},
        format="json",
    )

    with CaptureQueriesContext(connection) as ctx:
        response = api.patch(
            _url(broker),
            {"auto_approve_listings": False, "reason": "Measured."},
            format="json",
        )

    assert response.status_code == 200
    assert len(ctx) <= 25, [q["sql"] for q in ctx.captured_queries]

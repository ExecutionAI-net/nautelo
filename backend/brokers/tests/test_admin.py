from types import SimpleNamespace

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import Group
from django.test import RequestFactory

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.admin import BrokerOrganizationAdmin
from brokers.models import BrokerOrganization
from brokers.tests.factories import make_broker

POLICY_FIELDS = {
    "auto_approve_listings",
    "auto_approve_changed_by",
    "auto_approve_changed_at",
}


def _request(user):
    request = RequestFactory().get("/admin/brokers/brokerorganization/")
    request.user = user
    return request


@pytest.fixture
def broker_admin():
    return BrokerOrganizationAdmin(BrokerOrganization, AdminSite())


@pytest.mark.django_db
def test_a_moderator_cannot_edit_the_auto_approval_policy(broker_admin):
    moderator = make_user("mod@example.com", role=UserRole.STAFF, is_staff=True)
    moderator.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])

    readonly = set(broker_admin.get_readonly_fields(_request(moderator)))

    assert POLICY_FIELDS <= readonly


@pytest.mark.django_db
def test_a_staff_admin_can_edit_the_auto_approval_flag(broker_admin):
    admin_user = make_user("sa@example.com", role=UserRole.STAFF, is_staff=True)
    admin_user.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])

    readonly = set(broker_admin.get_readonly_fields(_request(admin_user)))

    assert "auto_approve_listings" not in readonly
    assert {"auto_approve_changed_by", "auto_approve_changed_at"} <= readonly


@pytest.mark.django_db
def test_toggling_the_flag_through_the_admin_records_the_actor_and_timestamp(broker_admin):
    """Spec 1: the auto-approval switch is "changed by staff and audited".

    Regression guard: if save_model() persists the field itself before calling
    set_broker_auto_approval(), the service sees the value already matching,
    short-circuits, and these two columns stay NULL while the toggle appears
    to have worked.
    """
    admin_user = make_user("sa2@example.com", role=UserRole.STAFF, is_staff=True)
    admin_user.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    broker = make_broker(name="Policy Broker", slug="policy-broker")
    assert broker.auto_approve_listings is False

    broker.auto_approve_listings = True
    broker_admin.save_model(
        _request(admin_user),
        broker,
        SimpleNamespace(
            changed_data=["auto_approve_listings"],
            cleaned_data={"auto_approve_reason": "Vetted partner."},
        ),
        change=True,
    )

    broker.refresh_from_db()
    assert broker.auto_approve_listings is True
    assert broker.auto_approve_changed_by == admin_user
    assert broker.auto_approve_changed_at is not None


@pytest.mark.django_db
def test_creating_a_broker_with_auto_approval_on_records_the_actor_and_timestamp(
    broker_admin,
):
    """The same audit guarantee, on the CREATE path rather than the change path."""
    admin_user = make_user("sa3@example.com", role=UserRole.STAFF, is_staff=True)
    admin_user.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    broker = BrokerOrganization(
        name="Born Approved",
        slug="born-approved",
        public_email="a@b.example",
        public_phone="+34600000002",
        auto_approve_listings=True,
    )

    broker_admin.save_model(
        _request(admin_user),
        broker,
        SimpleNamespace(
            changed_data=["auto_approve_listings"],
            cleaned_data={"auto_approve_reason": "Vetted partner."},
        ),
        change=False,
    )

    broker.refresh_from_db()
    assert broker.auto_approve_listings is True
    assert broker.auto_approve_changed_by == admin_user
    assert broker.auto_approve_changed_at is not None


@pytest.mark.django_db
def test_a_moderators_forged_toggle_is_a_no_op(broker_admin):
    moderator = make_user("mod2@example.com", role=UserRole.STAFF, is_staff=True)
    moderator.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    broker = make_broker(name="Guarded Broker", slug="guarded-broker")

    broker.auto_approve_listings = True
    broker_admin.save_model(
        _request(moderator),
        broker,
        SimpleNamespace(
            changed_data=["auto_approve_listings"],
            cleaned_data={"auto_approve_reason": "Vetted partner."},
        ),
        change=True,
    )

    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert broker.auto_approve_changed_by is None
    assert broker.auto_approve_changed_at is None


@pytest.mark.django_db
def test_the_admin_form_demands_a_reason_when_the_flag_changes():
    from brokers.forms import BrokerOrganizationAdminForm

    broker = make_broker(name="Form Broker", slug="form-broker")
    form = BrokerOrganizationAdminForm(
        data={
            "name": broker.name,
            "slug": broker.slug,
            "status": broker.status,
            "public_email": broker.public_email,
            "public_phone": broker.public_phone,
            "auto_approve_listings": "on",
            "auto_approve_reason": "",
        },
        instance=broker,
    )

    assert form.is_valid() is False
    assert "auto_approve_reason" in form.errors


@pytest.mark.django_db
def test_the_admin_form_accepts_an_unrelated_edit_with_no_reason():
    from brokers.forms import BrokerOrganizationAdminForm

    broker = make_broker(name="Form Broker 2", slug="form-broker-2")
    form = BrokerOrganizationAdminForm(
        data={
            "name": "Renamed",
            "slug": broker.slug,
            "status": broker.status,
            "public_email": broker.public_email,
            "public_phone": broker.public_phone,
            "auto_approve_reason": "",
        },
        instance=broker,
    )

    assert form.is_valid() is True, form.errors


def _form_data(broker, **overrides):
    data = {
        "name": broker.name,
        "slug": broker.slug,
        "status": broker.status,
        "public_email": broker.public_email,
        "public_phone": broker.public_phone,
        "auto_approve_listings": "on",
        "auto_approve_reason": "Vetted.",
    }
    data.update(overrides)
    return data


@pytest.mark.django_db
def test_the_admin_form_refuses_a_whitespace_only_reason_when_the_flag_changes():
    from brokers.forms import BrokerOrganizationAdminForm

    broker = make_broker(name="Form WS", slug="form-ws")
    form = BrokerOrganizationAdminForm(
        data=_form_data(broker, auto_approve_reason="   "), instance=broker
    )

    assert form.is_valid() is False
    assert "auto_approve_reason" in form.errors


@pytest.mark.django_db
def test_the_admin_form_accepts_a_reason_when_the_flag_changes():
    from brokers.forms import BrokerOrganizationAdminForm

    broker = make_broker(name="Form OK", slug="form-ok")
    form = BrokerOrganizationAdminForm(data=_form_data(broker), instance=broker)

    assert form.is_valid() is True, form.errors


@pytest.mark.django_db
def test_the_admin_form_reason_length_boundary_is_500_characters():
    from brokers.forms import BrokerOrganizationAdminForm

    broker = make_broker(name="Form Len", slug="form-len")
    at_limit = BrokerOrganizationAdminForm(
        data=_form_data(broker, auto_approve_reason="a" * 500), instance=broker
    )
    over_limit = BrokerOrganizationAdminForm(
        data=_form_data(broker, auto_approve_reason="a" * 501), instance=broker
    )

    assert at_limit.is_valid() is True, at_limit.errors
    assert over_limit.is_valid() is False
    assert "auto_approve_reason" in over_limit.errors


@pytest.mark.django_db
def test_the_admin_form_does_not_demand_a_reason_when_the_flag_is_unchanged():
    from brokers.forms import BrokerOrganizationAdminForm

    broker = make_broker(name="Form On", slug="form-on", auto_approve_listings=True)
    form = BrokerOrganizationAdminForm(
        data=_form_data(broker, auto_approve_reason=""), instance=broker
    )

    assert form.is_valid() is True, form.errors


@pytest.mark.django_db
def test_toggling_through_the_admin_writes_an_admin_sourced_audit_event(broker_admin):
    from audit.models import AuditEvent

    admin_user = make_user("sa4@example.com", role=UserRole.STAFF, is_staff=True)
    admin_user.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    broker = make_broker(name="Audited Admin", slug="audited-admin")

    broker.auto_approve_listings = True
    broker_admin.save_model(
        _request(admin_user),
        broker,
        SimpleNamespace(
            changed_data=["auto_approve_listings"],
            cleaned_data={"auto_approve_reason": "Reviewed in admin."},
        ),
        change=True,
    )

    event = AuditEvent.objects.get(target_id=str(broker.pk))
    assert event.source == AuditEvent.Source.ADMIN
    assert event.actor_user == admin_user
    assert event.metadata["reason"] == "Reviewed in admin."


@pytest.mark.django_db
def test_creating_a_broker_with_auto_approval_on_writes_an_admin_sourced_audit_event(
    broker_admin,
):
    from audit.models import AuditEvent

    admin_user = make_user("sa5@example.com", role=UserRole.STAFF, is_staff=True)
    admin_user.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    broker = BrokerOrganization(
        name="Born Audited",
        slug="born-audited",
        public_email="a@b.example",
        public_phone="+34600000003",
        auto_approve_listings=True,
    )

    broker_admin.save_model(
        _request(admin_user),
        broker,
        SimpleNamespace(
            changed_data=["auto_approve_listings"],
            cleaned_data={"auto_approve_reason": "Onboarded pre-vetted."},
        ),
        change=False,
    )

    event = AuditEvent.objects.get(target_id=str(broker.pk))
    assert event.source == AuditEvent.Source.ADMIN
    assert event.metadata["reason"] == "Onboarded pre-vetted."


@pytest.mark.django_db
def test_a_moderators_forged_toggle_writes_no_audit_event(broker_admin):
    from audit.models import AuditEvent

    moderator = make_user("mod3@example.com", role=UserRole.STAFF, is_staff=True)
    moderator.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    broker = make_broker(name="Guarded Audit", slug="guarded-audit")

    broker.auto_approve_listings = True
    broker_admin.save_model(
        _request(moderator),
        broker,
        SimpleNamespace(
            changed_data=["auto_approve_listings"],
            cleaned_data={"auto_approve_reason": "Forged."},
        ),
        change=True,
    )

    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0

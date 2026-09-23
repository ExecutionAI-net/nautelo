import pytest
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.models import User
from brokers.models import BrokerMembership, BrokerOrganization, BrokerPlan
from professionals.models import ProfessionalMembership, ProfessionalProfile
from services_catalog.models import ProfessionalService
from services_catalog.tests.factories import make_service_category

pytestmark = pytest.mark.django_db

URL = "auth-register-organization"
BASE = {
    "organization_name": "Blue Rigging",
    "full_name": "Mia Rossi",
    "email": "Mia@Blue-Rigging.example",
    "password": "Str0ng-Org-Pass!",
    "phone": "+34600000000",
    "country_code": "es",
}


@pytest.fixture(autouse=True)
def _category():
    return make_service_category(slug="rigging", name_en="Rigging")


def _post(**extra):
    extra.setdefault("category", "rigging")
    return APIClient().post(reverse(URL), {**BASE, **extra}, format="json")


def test_professional_registration_creates_owner_org_and_seat(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        res = _post(org_type="PROFESSIONAL")
    assert res.status_code == 201
    user = User.objects.get(email="mia@blue-rigging.example")
    assert user.primary_role == UserRole.PROFESSIONAL and not user.is_email_verified
    assert user.phone_number == "+34600000000"
    assert user.newsletter_opt_in is False
    profile = ProfessionalProfile.objects.get(owner_user=user)
    assert (profile.status, profile.country_code, profile.display_name) == ("DRAFT", "ES", "Blue Rigging")
    seat = ProfessionalMembership.objects.get(user=user)
    assert (seat.role, seat.is_owner) == ("ADMIN", True)
    assert mail.outbox and "verify-email" in mail.outbox[-1].body


def test_professional_registration_requires_a_category():
    res = _post(org_type="PROFESSIONAL", category="")
    assert res.status_code == 400
    assert "category" in res.data["error"]["fields"]


def test_professional_registration_creates_its_first_service_from_the_chosen_category():
    res = _post(org_type="PROFESSIONAL")
    assert res.status_code == 201
    profile = ProfessionalProfile.objects.get(display_name="Blue Rigging")
    service = ProfessionalService.objects.get(professional=profile)
    assert (service.category.slug, service.title_en, service.is_active) == ("rigging", "Rigging", True)


def test_broker_registration_needs_an_active_plan_and_seats_the_owner():
    plan = BrokerPlan.objects.filter(is_active=True).first() or BrokerPlan.objects.create(
        slug="starter-x", name="Starter", monthly_price=99
    )
    assert _post(org_type="BROKER").status_code == 400
    res = _post(org_type="BROKER", plan=plan.slug)
    assert res.status_code == 201
    user = User.objects.get(email="mia@blue-rigging.example")
    broker = BrokerOrganization.objects.get(name="Blue Rigging")
    assert (user.primary_role, broker.status, broker.plan) == (UserRole.BROKER, "DRAFT", plan)
    assert BrokerMembership.objects.get(user=user, broker=broker).role == "ADMIN"


def test_the_owner_can_opt_into_the_newsletter():
    plan = BrokerPlan.objects.filter(is_active=True).first() or BrokerPlan.objects.create(
        slug="starter-y", name="Starter", monthly_price=99
    )
    assert _post(org_type="BROKER", plan=plan.slug, newsletter_opt_in=True).status_code == 201
    assert User.objects.get(email="mia@blue-rigging.example").newsletter_opt_in is True


def test_duplicate_email_and_bad_role_are_refused():
    assert _post(org_type="PROFESSIONAL").status_code == 201
    assert _post(org_type="PROFESSIONAL").status_code == 400
    assert _post(org_type="STAFF", email="x@y.example").status_code == 400
    assert not ProfessionalProfile.objects.filter(display_name="Blue Rigging").count() > 1


def test_same_name_gets_a_distinct_slug():
    _post(org_type="PROFESSIONAL")
    _post(org_type="PROFESSIONAL", email="other@blue.example")
    slugs = set(ProfessionalProfile.objects.values_list("slug", flat=True))
    assert slugs == {"blue-rigging", "blue-rigging-2"}


def test_the_broker_owner_cannot_be_demoted_or_removed():
    from django.urls import reverse as rev

    from accounts.tests.factories import make_user
    from brokers.tests.factories import make_membership

    plan = BrokerPlan.objects.filter(is_active=True).first() or BrokerPlan.objects.create(slug="s-x", name="S", monthly_price=9)
    _post(org_type="BROKER", plan=plan.slug)
    owner = User.objects.get(email="mia@blue-rigging.example")
    broker = BrokerOrganization.objects.get(name="Blue Rigging")
    owner_seat = BrokerMembership.objects.get(user=owner)
    assert owner_seat.is_owner
    other = make_user("admin2@x.example", role=UserRole.BROKER, verified=True)
    make_membership(other, broker, role="ADMIN", can_edit_listings=True, can_manage_team=True, can_read_messages=True)
    api = APIClient()
    api.force_authenticate(other)
    url = rev("broker-member-detail", args=[broker.pk, owner_seat.pk])
    assert api.patch(url, {"role": "VIEWER"}, format="json").status_code == 400
    assert api.delete(url).status_code == 400


def test_markup_in_the_name_and_junk_phone_are_refused():
    assert _post(org_type="PROFESSIONAL", organization_name="<b>x</b>").status_code == 400
    assert _post(org_type="PROFESSIONAL", phone="abc").status_code == 400
    assert _post(org_type="PROFESSIONAL", phone="+34 600 111 222").status_code == 201


def test_an_unverified_owner_cannot_open_the_membership_checkout():
    from accounts.tests.factories import make_user
    from professionals.tests.factories import make_professional

    owner = make_user("unv@pro.example", role=UserRole.PROFESSIONAL, verified=False)
    make_professional(owner)
    api = APIClient()
    api.force_authenticate(owner)
    assert api.post(reverse("provider-membership-checkout")).status_code == 403

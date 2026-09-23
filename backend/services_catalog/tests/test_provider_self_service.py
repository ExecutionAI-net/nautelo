import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from professionals.models import ProfessionalProfile
from services_catalog.models import ServiceCategory

pytestmark = pytest.mark.django_db

PROFILE = {
    "display_name": "Blue Rigging",
    "public_email": "b@example.com",
    "public_phone": "+34600000000",
    "country_code": "es",
}


def client_for(role=UserRole.PROFESSIONAL, email="prov@example.com"):
    client = APIClient()
    client.force_authenticate(make_user(email=email, role=role, verified=True))
    return client


def test_only_service_providers_may_use_the_endpoints():
    assert client_for(UserRole.PRIVATE_SELLER, "b1@example.com").get(reverse("provider-profile")).status_code == 403
    assert APIClient().get(reverse("provider-profile")).status_code in (401, 403)


def test_profile_lifecycle_and_submit():
    api = client_for()
    assert api.get(reverse("provider-profile")).status_code == 404
    created = api.post(reverse("provider-profile"), PROFILE, format="json")
    assert created.status_code == 201
    assert created.json()["status"] == "DRAFT"
    assert created.json()["country_code"] == "ES"
    assert api.post(reverse("provider-profile"), PROFILE, format="json").status_code == 409
    # Submitting an unfinished profile is refused, and says what is missing.
    incomplete = api.patch(reverse("provider-profile"), {"city": "Palma", "submit": True}, format="json")
    assert incomplete.status_code == 400
    assert "profile_incomplete" in str(incomplete.json())
    saved = api.get(reverse("provider-profile")).json()
    assert saved["city"] == "Palma"
    assert set(saved["completeness"]["missing"]) == {"short_description", "description", "service_area", "services"}

    category = ServiceCategory.objects.create(name_en="Rigging", slug="rigging-x")
    api.post(reverse("provider-service-list"), {"category": str(category.id), "title_en": "Mast"}, format="json")
    full = {
        "short_description": "Rigging experts",
        "description": "We rig, repair and inspect sailing yachts across the western Mediterranean coast.",
        "service_area": ["ES-IB"],
        "submit": True,
    }
    # Complete, but no subscription yet.
    unpaid = api.patch(reverse("provider-profile"), full, format="json")
    assert unpaid.status_code == 400 and "subscription_required" in str(unpaid.json())

    from professionals.models import ProfessionalSubscription

    ProfessionalSubscription.objects.create(profile=ProfessionalProfile.objects.get(), status="TRIALING")
    patched = api.patch(reverse("provider-profile"), {**full, "status": "ACTIVE"}, format="json").json()
    assert patched["status"] == "PENDING"
    assert patched["completeness"]["percent"] == 100


def test_services_are_scoped_to_the_owner():
    api = client_for()
    other = client_for(email="prov2@example.com")
    category = ServiceCategory.objects.create(name_en="Rigging", slug="rigging")
    body = {"category": str(category.id), "title_en": "Mast"}
    assert api.post(reverse("provider-service-list"), body, format="json").status_code == 404
    api.post(reverse("provider-profile"), PROFILE, format="json")
    other.post(reverse("provider-profile"), {**PROFILE, "display_name": "Other Co"}, format="json")
    made = api.post(reverse("provider-service-list"), body, format="json")
    assert made.status_code == 201
    assert len(api.get(reverse("provider-service-list")).json()) == 1
    assert other.get(reverse("provider-service-list")).json() == []
    url = reverse("provider-service-detail", args=[made.json()["id"]])
    assert other.patch(url, {"is_active": False}, format="json").status_code == 404
    assert api.patch(url, {"is_active": False}, format="json").json()["is_active"] is False
    assert api.delete(url).status_code == 204
    assert ProfessionalProfile.objects.count() == 2


def test_unverified_owner_can_read_but_not_change_the_profile():
    client = APIClient()
    client.force_authenticate(make_user(email="unver@example.com", role=UserRole.PROFESSIONAL, verified=False))
    assert client.get(reverse("provider-profile")).status_code == 404
    denied = client.post(reverse("provider-profile"), PROFILE, format="json")
    assert denied.status_code == 403 and "email_not_verified" in str(denied.json())


def test_country_outside_the_supported_markets_is_refused():
    response = client_for(email="fr@example.com").post(reverse("provider-profile"), {**PROFILE, "country_code": "FR"}, format="json")
    assert response.status_code == 400


def test_category_can_be_set_on_create_and_changed_later():
    from services_catalog.models import ProfessionalService

    rigging = ServiceCategory.objects.create(name_en="Rigging", slug="rigging-y")
    valeting = ServiceCategory.objects.create(name_en="Valeting", slug="valeting-y")
    api = client_for()

    created = api.post(reverse("provider-profile"), {**PROFILE, "category": rigging.slug}, format="json")
    assert created.status_code == 201
    assert created.json()["category"] == rigging.slug
    profile = ProfessionalProfile.objects.get()
    assert ProfessionalService.objects.get(professional=profile).category == rigging

    changed = api.patch(reverse("provider-profile"), {"category": valeting.slug}, format="json")
    assert changed.status_code == 200
    assert changed.json()["category"] == valeting.slug
    # The dropdown changes the existing primary service's category in place
    # rather than adding a second one.
    assert ProfessionalService.objects.filter(professional=profile).count() == 1
    assert ProfessionalService.objects.get(professional=profile).category == valeting


def test_an_inactive_or_unknown_category_is_refused():
    ServiceCategory.objects.create(name_en="Hidden", slug="hidden-y", is_active=False)
    api = client_for()
    response = api.post(reverse("provider-profile"), {**PROFILE, "category": "hidden-y"}, format="json")
    assert response.status_code == 400
    response = api.post(reverse("provider-profile"), {**PROFILE, "category": "does-not-exist"}, format="json")
    assert response.status_code == 400


def test_category_is_read_from_the_manually_added_service_when_no_dropdown_value_was_sent():
    category = ServiceCategory.objects.create(name_en="Rigging", slug="rigging-z")
    api = client_for()
    api.post(reverse("provider-profile"), PROFILE, format="json")
    assert api.get(reverse("provider-profile")).json()["category"] == ""
    api.post(reverse("provider-service-list"), {"category": str(category.id), "title_en": "Mast"}, format="json")
    assert api.get(reverse("provider-profile")).json()["category"] == category.slug

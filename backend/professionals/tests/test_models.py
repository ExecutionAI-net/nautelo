import uuid

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile
from professionals.tests.factories import make_professional


@pytest.mark.django_db
def test_profile_has_a_uuid_pk_and_defaults_to_draft():
    owner = make_user("pro@example.com", role=UserRole.PROFESSIONAL)
    profile = ProfessionalProfile.objects.create(
        owner_user=owner,
        display_name="Draft Pro",
        slug="draft-pro",
        public_email="d@p.example",
        public_phone="+34600000002",
        country_code="ES",
    )
    assert isinstance(profile.pk, uuid.UUID)
    assert profile.status == ProfessionalProfileStatus.DRAFT
    assert profile.is_active is False
    assert profile.service_area == []


@pytest.mark.django_db
def test_a_user_can_own_only_one_profile():
    owner = make_user("single@example.com", role=UserRole.PROFESSIONAL)
    make_professional(owner)
    with pytest.raises(IntegrityError), transaction.atomic():
        make_professional(owner, display_name="Second", slug="second-profile")


@pytest.mark.django_db
def test_slug_is_unique_across_profiles():
    make_professional(make_user("a@example.com", role=UserRole.PROFESSIONAL))
    with pytest.raises(IntegrityError), transaction.atomic():
        make_professional(
            make_user("b@example.com", role=UserRole.PROFESSIONAL),
            display_name="Clash",
        )


@pytest.mark.django_db
def test_profile_is_reachable_from_its_owner():
    owner = make_user("reverse@example.com", role=UserRole.PROFESSIONAL)
    profile = make_professional(owner)
    owner.refresh_from_db()
    assert owner.professional_profile == profile


@pytest.mark.django_db
def test_absolute_url_matches_the_canonical_public_route():
    owner = make_user("url@example.com", role=UserRole.PROFESSIONAL)
    profile = make_professional(owner, slug="ocean-legal")
    assert profile.get_absolute_url() == "/services/professionals/ocean-legal/"


@pytest.mark.django_db
def test_active_status_exposes_is_active():
    owner = make_user("active@example.com", role=UserRole.PROFESSIONAL)
    assert make_professional(owner).is_active is True


@pytest.mark.django_db
@pytest.mark.parametrize("bad_value", [{"regions": ["IT-52"]}, ["IT-52", ""], "IT-52", [1, 2]])
def test_service_area_must_be_a_list_of_non_empty_strings(bad_value):
    owner = make_user("area@example.com", role=UserRole.PROFESSIONAL)
    profile = ProfessionalProfile(
        owner_user=owner,
        display_name="Area Pro",
        slug="area-pro",
        public_email="a@a.example",
        public_phone="+34600000003",
        country_code="ES",
        service_area=bad_value,
    )
    with pytest.raises(ValidationError):
        profile.full_clean()

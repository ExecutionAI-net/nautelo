import uuid

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from professionals.tests.factories import make_professional
from services_catalog.models import ProfessionalService, ServiceCategory
from services_catalog.tests.factories import make_professional_service, make_service_category


@pytest.fixture
def professional(db):
    return make_professional(make_user("svc@example.com", role=UserRole.PROFESSIONAL))


@pytest.fixture
def category(db):
    return make_service_category(slug="legal-test", name_en="Legal")


@pytest.mark.django_db
def test_service_has_a_uuid_pk_and_sane_defaults(professional, category):
    service = make_professional_service(professional, category)

    assert isinstance(service.pk, uuid.UUID)
    assert service.is_active is True
    assert service.title_it == ""
    assert service.description_en == ""
    assert service.created_at is not None


@pytest.mark.django_db
def test_services_are_reachable_from_the_professional(professional, category):
    service = make_professional_service(professional, category)

    assert list(professional.services.all()) == [service]


@pytest.mark.django_db
def test_the_same_title_cannot_repeat_in_the_same_category_for_one_professional(
    professional, category
):
    make_professional_service(professional, category, title_en="Flag registration")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_professional_service(professional, category, title_en="Flag registration")


@pytest.mark.django_db
def test_the_same_title_is_allowed_in_a_different_category(professional, category):
    other = make_service_category(slug="insurance-test", name_en="Insurance")
    make_professional_service(professional, category, title_en="Flag registration")

    make_professional_service(professional, other, title_en="Flag registration")

    assert professional.services.count() == 2


@pytest.mark.django_db
def test_service_area_must_be_a_list_of_non_empty_strings(professional, category):
    service = ProfessionalService(
        professional=professional,
        category=category,
        title_en="Bad area",
        service_area="IT-52",
    )

    with pytest.raises(ValidationError):
        service.full_clean()


@pytest.mark.django_db
def test_deleting_the_professional_deletes_its_services(professional, category):
    make_professional_service(professional, category)

    professional.delete()

    assert ProfessionalService.objects.count() == 0


@pytest.mark.django_db
def test_a_category_in_use_cannot_be_deleted(professional, category):
    make_professional_service(professional, category)

    with pytest.raises(ProtectedError):
        category.delete()

    assert ServiceCategory.objects.filter(pk=category.pk).exists()


@pytest.mark.django_db
def test_default_ordering_follows_category_display_order_then_title(professional):
    second = make_service_category(slug="insurance-test", name_en="Insurance", display_order=2)
    first = make_service_category(slug="legal-test", name_en="Legal", display_order=1)
    make_professional_service(professional, second, title_en="Hull cover")
    make_professional_service(professional, first, title_en="Sale contracts")

    assert [s.title_en for s in ProfessionalService.objects.all()] == [
        "Sale contracts",
        "Hull cover",
    ]

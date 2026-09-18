import uuid

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from services_catalog.models import ServiceCategory
from services_catalog.services import DEFAULT_LOCALE, localized, resolve_locale
from services_catalog.tests.factories import make_service_category


@pytest.mark.django_db
def test_category_has_a_uuid_pk_and_sane_defaults():
    category = make_service_category()

    assert isinstance(category.pk, uuid.UUID)
    assert category.is_active is True
    assert category.has_seo_page is False
    assert category.display_order == 0
    assert category.name_it == ""
    assert category.description_en == ""


@pytest.mark.django_db
def test_slug_is_unique():
    make_service_category(slug="test-unique")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_service_category(slug="test-unique", name_en="Test unique again")


@pytest.mark.django_db
def test_reserved_slug_is_rejected_by_validation():
    category = ServiceCategory(slug="professionals", name_en="Professionals")

    with pytest.raises(ValidationError):
        category.full_clean()


@pytest.mark.django_db
def test_reserved_slug_is_rejected_by_the_database_even_without_full_clean():
    with pytest.raises(IntegrityError), transaction.atomic():
        ServiceCategory.objects.create(slug="professionals", name_en="Professionals")


@pytest.mark.django_db
def test_default_ordering_is_display_order_then_english_name():
    make_service_category(slug="zeta", name_en="Zeta", display_order=1)
    make_service_category(slug="beta", name_en="Beta", display_order=2)
    make_service_category(slug="alpha", name_en="Alpha", display_order=1)

    test_categories = ServiceCategory.objects.filter(slug__in=["zeta", "beta", "alpha"])
    assert [c.slug for c in test_categories] == ["alpha", "zeta", "beta"]


@pytest.mark.django_db
def test_absolute_url_is_the_seo_service_route():
    assert make_service_category(slug="test-service").get_absolute_url() == "/services/test-service/"


@pytest.mark.django_db
def test_localized_returns_the_requested_language():
    category = make_service_category(name_en="Legal", name_it="Legale", name_es="Legal ES")

    assert localized(category, "name", "it") == "Legale"
    assert localized(category, "name", "es") == "Legal ES"


@pytest.mark.django_db
def test_localized_falls_back_to_english_when_the_translation_is_blank():
    category = make_service_category(name_en="Legal", name_it="")

    assert localized(category, "name", "it") == "Legal"


@pytest.mark.parametrize(
    "raw,expected",
    [("en", "en"), ("IT", "it"), ("es", "es"), ("ES", "es"), ("de", "en"), ("", "en"), (None, "en")],
)
def test_resolve_locale_normalizes_and_defaults_to_english(raw, expected):
    assert resolve_locale(raw) == expected
    assert DEFAULT_LOCALE == "en"

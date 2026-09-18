import pytest

from services_catalog.models import ServiceCategory

EXPECTED_SLUGS = [
    "full-brokerage",
    "legal",
    "insurance",
    "engines-maintenance",
    "transport-delivery",
    "nautical-marketing",
]


@pytest.mark.django_db
def test_the_six_approved_seo_categories_are_seeded():
    seeded = ServiceCategory.objects.filter(has_seo_page=True).order_by("display_order")

    assert [c.slug for c in seeded] == EXPECTED_SLUGS


@pytest.mark.django_db
def test_seeded_categories_are_active_and_named_in_all_three_languages():
    for category in ServiceCategory.objects.filter(has_seo_page=True):
        assert category.is_active is True
        assert category.name_en.strip()
        assert category.name_it.strip()
        assert category.name_es.strip()


@pytest.mark.django_db
def test_seeded_categories_carry_no_invented_copy():
    for category in ServiceCategory.objects.filter(has_seo_page=True):
        assert category.description_en == ""
        assert category.description_it == ""
        assert category.description_es == ""
        assert category.seo_title_en == ""
        assert category.seo_description_en == ""


@pytest.mark.django_db
def test_every_seeded_slug_matches_a_spec_4_1_public_route():
    for slug in EXPECTED_SLUGS:
        category = ServiceCategory.objects.get(slug=slug)
        assert category.get_absolute_url() == f"/services/{slug}/"

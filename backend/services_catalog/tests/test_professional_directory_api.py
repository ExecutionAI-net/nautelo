from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile
from professionals.tests.factories import make_professional
from services_catalog.tests.factories import (
    disable_combined_directory,
    make_professional_service,
    make_service_category,
)

# No autouse cache fixture here: the project-root backend/conftest.py clears the
# whole cache around every test in the suite — both the feature-flag value and
# the shared `services_directory` throttle bucket, which these API files would
# otherwise exhaust between them.
#
# Category slugs below carry a `-test` suffix because migration
# 0002_seed_seo_service_categories already seeds the real `legal` / `insurance`
# rows, and ServiceCategory.slug is unique.


def build_professional(
    email, *, slug, display_name, status=ProfessionalProfileStatus.ACTIVE, **extra
):
    return make_professional(
        make_user(email, role=UserRole.PROFESSIONAL),
        slug=slug,
        display_name=display_name,
        status=status,
        **extra,
    )


@pytest.mark.django_db
def test_only_active_professionals_are_listed():
    # `active-pro` deliberately has NO ProfessionalService rows. Listing is
    # keyed on status == ACTIVE and nothing else, so a zero-service profile is
    # public with active_service_count: 0 and no categories. This is the tested
    # counterpart of the deferred publication gate (see Known Limitations):
    # Phase 17 may change the rule, but it must update this test in the same
    # commit rather than quietly filtering such profiles out of the queryset.
    build_professional("a@example.com", slug="active-pro", display_name="Active Pro")
    build_professional(
        "d@example.com",
        slug="draft-pro",
        display_name="Draft Pro",
        status=ProfessionalProfileStatus.DRAFT,
    )
    build_professional(
        "s@example.com",
        slug="susp-pro",
        display_name="Suspended Pro",
        status=ProfessionalProfileStatus.SUSPENDED,
    )

    response = APIClient().get("/api/v1/professionals/")

    assert response.status_code == 200
    assert [r["slug"] for r in response.data["results"]] == ["active-pro"]


@pytest.mark.django_db
def test_results_never_contain_contact_details():
    build_professional("c@example.com", slug="contact-pro", display_name="Contact Pro")

    result = APIClient().get("/api/v1/professionals/").data["results"][0]

    assert "public_email" not in result
    assert "public_phone" not in result
    assert "website_url" not in result


@pytest.mark.django_db
def test_category_filter_returns_only_providers_offering_that_category():
    legal = make_service_category(slug="legal-test", name_en="Legal")
    insurance = make_service_category(slug="insurance-test", name_en="Insurance")
    lawyer = build_professional("l@example.com", slug="lawyer", display_name="Lawyer")
    insurer = build_professional("i@example.com", slug="insurer", display_name="Insurer")
    make_professional_service(lawyer, legal, title_en="Sale contracts")
    make_professional_service(insurer, insurance, title_en="Hull cover")

    response = APIClient().get("/api/v1/professionals/", {"category": "legal-test"})

    assert [r["slug"] for r in response.data["results"]] == ["lawyer"]


@pytest.mark.django_db
def test_an_inactive_service_does_not_place_a_provider_in_a_category():
    legal = make_service_category(slug="legal-test", name_en="Legal")
    pro = build_professional("x@example.com", slug="retired-legal", display_name="Retired Legal")
    make_professional_service(pro, legal, title_en="Old service", is_active=False)

    response = APIClient().get("/api/v1/professionals/", {"category": "legal-test"})

    assert response.data["results"] == []


@pytest.mark.django_db
def test_text_search_matches_display_name_and_service_titles():
    legal = make_service_category(slug="legal-test", name_en="Legal")
    build_professional("n@example.com", slug="ocean-legal", display_name="Ocean Legal")
    other = build_professional("o@example.com", slug="port-agency", display_name="Port Agency")
    make_professional_service(other, legal, title_en="Ocean survey coordination")
    build_professional("z@example.com", slug="unrelated", display_name="Unrelated")

    slugs = {
        r["slug"]
        for r in APIClient().get("/api/v1/professionals/", {"q": "ocean"}).data["results"]
    }

    assert slugs == {"ocean-legal", "port-agency"}


@pytest.mark.django_db
def test_location_matches_city_region_or_an_exact_service_area_entry():
    # Phase 3's make_professional defaults service_area to ["IT-52"]. Three of
    # these four fixtures must therefore pass service_area=[] explicitly, or
    # every one of them matches slugs_for("IT-52") and the last assertion below
    # silently tests nothing.
    build_professional(
        "c1@example.com",
        slug="in-city",
        display_name="In City",
        city="Livorno",
        service_area=[],
    )
    build_professional(
        "r1@example.com",
        slug="in-region",
        display_name="In Region",
        region="Toscana",
        service_area=[],
    )
    build_professional(
        "a1@example.com", slug="in-area", display_name="In Area", service_area=["IT-52"]
    )
    build_professional(
        "n1@example.com",
        slug="elsewhere",
        display_name="Elsewhere",
        city="Palma",
        service_area=[],
    )
    client = APIClient()

    def slugs_for(location):
        return [
            r["slug"]
            for r in client.get("/api/v1/professionals/", {"location": location}).data["results"]
        ]

    assert slugs_for("livorno") == ["in-city"]
    assert slugs_for("Toscana") == ["in-region"]
    assert slugs_for("IT-52") == ["in-area"]


@pytest.mark.django_db
def test_country_filter_returns_only_professionals_in_that_country():
    build_professional("es@example.com", slug="es-pro", display_name="ES Pro", country_code="ES")
    build_professional("it@example.com", slug="it-pro", display_name="IT Pro", country_code="IT")

    response = APIClient().get("/api/v1/professionals/", {"country": "es"})

    assert [r["slug"] for r in response.data["results"]] == ["es-pro"]
    facets = response.data["facets"]
    assert facets["countries"] == {"ES": 1, "IT": 1}


@pytest.mark.django_db
def test_place_id_filters_exactly_and_only_geocoded_professionals_reach_the_location_facet():
    palma = build_professional(
        "p1@example.com",
        slug="palma-pro",
        display_name="Palma Pro",
        city="Palma de Mallorca",
        country_code="ES",
        place_geoname_id=3128760,
    )
    # Free text only, never run through the standard place picker - still
    # counts toward its country, but must not appear as a fake city choice.
    build_professional(
        "g1@example.com",
        slug="genoa-pro",
        display_name="Genoa Pro",
        city="Genoa",
        country_code="IT",
    )

    client = APIClient()
    url = "/api/v1/professionals/"
    assert [r["slug"] for r in client.get(url, {"place": "3128760"}).data["results"]] == ["palma-pro"]
    assert client.get(url, {"place": "999999"}).data["results"] == []

    facets = client.get(url).data["facets"]
    assert facets["locations"] == [{"country": "ES", "place_id": 3128760, "city": "Palma de Mallorca", "count": 1}]


@pytest.mark.django_db
def test_country_and_category_facets_respect_each_others_currently_applied_filter():
    # Reproduces the reported bug: Croatia showed "(7)" next to it even though
    # only 1 of those 7 professionals actually offers "Full brokerage" -
    # picking that specialization must narrow the country counts to match.
    legal = make_service_category(slug="legal-test", name_en="Legal")
    brokerage = make_service_category(slug="full-brokerage-test", name_en="Full brokerage")

    hr_broker = build_professional("hr-b@example.com", slug="hr-broker", display_name="HR Broker", country_code="HR")
    make_professional_service(hr_broker, brokerage, title_en="Full brokerage service")
    for i in range(6):
        pro = build_professional(f"hr-l{i}@example.com", slug=f"hr-legal-{i}", display_name=f"HR Legal {i}", country_code="HR")
        make_professional_service(pro, legal, title_en="Legal advice")

    es_broker = build_professional("es-b@example.com", slug="es-broker", display_name="ES Broker", country_code="ES")
    make_professional_service(es_broker, brokerage, title_en="Full brokerage service")

    client = APIClient()
    url = "/api/v1/professionals/"

    # Unfiltered: Croatia's grand total is 7, both categories show their own total.
    facets = client.get(url).data["facets"]
    assert facets["countries"]["HR"] == 7
    assert facets["categories"] == {"legal-test": 6, "full-brokerage-test": 2}

    # Selecting a category narrows the COUNTRY counts to that category alone.
    facets = client.get(url, {"category": "full-brokerage-test"}).data["facets"]
    assert facets["countries"] == {"HR": 1, "ES": 1}

    # Selecting a country narrows the CATEGORY counts to that country alone.
    facets = client.get(url, {"country": "HR"}).data["facets"]
    assert facets["categories"] == {"legal-test": 6, "full-brokerage-test": 1}


@pytest.mark.django_db
def test_recommended_sort_puts_broader_catalogues_first_then_alphabetical():
    legal = make_service_category(slug="legal-test", name_en="Legal")
    insurance = make_service_category(slug="insurance-test", name_en="Insurance")
    broad = build_professional("b@example.com", slug="zeta-broad", display_name="Zeta Broad")
    narrow = build_professional("s@example.com", slug="alpha-narrow", display_name="Alpha Narrow")
    make_professional_service(broad, legal, title_en="Contracts")
    make_professional_service(broad, insurance, title_en="Cover")
    make_professional_service(narrow, legal, title_en="Advice")
    client = APIClient()

    recommended = [r["slug"] for r in client.get("/api/v1/professionals/").data["results"]]
    alphabetical = [
        r["slug"]
        for r in client.get("/api/v1/professionals/", {"sort": "alphabetical"}).data["results"]
    ]

    assert recommended == ["zeta-broad", "alpha-narrow"]
    assert alphabetical == ["alpha-narrow", "zeta-broad"]


@pytest.mark.django_db
def test_name_sort_can_go_either_direction():
    build_professional("b@example.com", slug="zeta-co", display_name="Zeta Co")
    build_professional("s@example.com", slug="alpha-co", display_name="Alpha Co")
    client = APIClient()

    asc = [r["slug"] for r in client.get("/api/v1/professionals/", {"sort": "name_asc"}).data["results"]]
    desc = [r["slug"] for r in client.get("/api/v1/professionals/", {"sort": "name_desc"}).data["results"]]

    assert asc == ["alpha-co", "zeta-co"]
    assert desc == ["zeta-co", "alpha-co"]


@pytest.mark.django_db
def test_newest_and_oldest_sort_by_when_the_profile_was_created():
    old = build_professional("o@example.com", slug="old-co", display_name="Old Co")
    ProfessionalProfile.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=10))
    build_professional("n@example.com", slug="new-co", display_name="New Co")
    client = APIClient()

    newest = [r["slug"] for r in client.get("/api/v1/professionals/", {"sort": "newest"}).data["results"]]
    oldest = [r["slug"] for r in client.get("/api/v1/professionals/", {"sort": "oldest"}).data["results"]]

    assert newest == ["new-co", "old-co"]
    assert oldest == ["old-co", "new-co"]


@pytest.mark.django_db
def test_a_service_reports_its_price_or_quote_on_request():
    legal = make_service_category(slug="legal-test", name_en="Legal")
    pro = build_professional("pr@example.com", slug="priced-pro", display_name="Priced Pro")
    make_professional_service(pro, legal, title_en="Sale contract review", price_from="150.00", pricing_note="per contract")
    make_professional_service(pro, legal, title_en="Free consult", price_from=None)

    services = APIClient().get(f"/api/v1/professionals/{pro.slug}/").data["services"]
    by_title = {service["title"]: service for service in services}

    assert by_title["Sale contract review"]["price_from"] == "150.00"
    assert by_title["Sale contract review"]["pricing_note"] == "per contract"
    assert by_title["Free consult"]["price_from"] is None


@pytest.mark.django_db
def test_a_card_reports_its_categories_in_the_requested_locale():
    legal = make_service_category(slug="legal-test", name_en="Legal", name_it="Legale")
    pro = build_professional("k@example.com", slug="cat-pro", display_name="Cat Pro")
    make_professional_service(pro, legal, title_en="Contracts")

    result = APIClient().get("/api/v1/professionals/", {"locale": "it"}).data["results"][0]

    assert result["categories"] == [{"slug": "legal-test", "name": "Legale"}]
    assert result["active_service_count"] == 1
    assert result["url"] == "/services/professionals/cat-pro/"


@pytest.mark.django_db
def test_active_service_count_is_not_inflated_when_a_query_filter_rejoins_services():
    # Regression test for the Count("services", ..., distinct=True) annotation.
    # The `q` filter adds a second join onto the same `services` relation
    # (separate from the one the annotation itself uses), which multiplies
    # the joined rows in the base queryset. Without distinct=True, that
    # non-distinct Count would double: a profile with 2 active services would
    # report active_service_count == 4, and would appear twice in `results`
    # because the multiplied rows also break `.distinct()` at the row level
    # for anything keyed off the count. This must stay 2 and appear once.
    legal = make_service_category(slug="legal-test", name_en="Legal")
    insurance = make_service_category(slug="insurance-test", name_en="Insurance")
    pro = build_professional("m@example.com", slug="multi-service", display_name="Multi Service")
    make_professional_service(pro, legal, title_en="Ocean Survey Coordination")
    make_professional_service(pro, insurance, title_en="Ocean Salvage Response")

    response = APIClient().get("/api/v1/professionals/", {"q": "ocean"})

    assert [r["slug"] for r in response.data["results"]] == ["multi-service"]
    assert response.data["results"][0]["active_service_count"] == 2


@pytest.mark.django_db
def test_results_are_paginated_with_the_standard_envelope():
    for index in range(14):
        build_professional(
            f"p{index}@example.com", slug=f"pro-{index:02d}", display_name=f"Pro {index:02d}"
        )

    response = APIClient().get("/api/v1/professionals/")

    assert response.data["count"] == 14
    assert len(response.data["results"]) == 12
    assert response.data["next"] is not None
    assert response.data["previous"] is None


@pytest.mark.django_db
def test_an_empty_directory_returns_an_empty_result_set_not_an_error():
    response = APIClient().get("/api/v1/professionals/")

    assert response.status_code == 200
    assert response.data["count"] == 0
    assert response.data["results"] == []


@pytest.mark.django_db
def test_the_directory_404s_when_the_rollout_flag_is_off():
    disable_combined_directory()

    assert APIClient().get("/api/v1/professionals/").status_code == 404

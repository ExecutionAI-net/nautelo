import pytest

from finance.models import FinanceConfigurationVersion
from finance.services import FinanceConfigurationService


@pytest.mark.django_db
def test_public_settings_endpoint_returns_all_seeded_keys(client):
    response = client.get("/api/v1/platform/public-settings/")

    assert response.status_code == 200
    body = response.json()

    assert body["settings_version"] == 1
    assert "updated_at" in body
    assert body["settings"] == {
        "finance.enabled": True,
        "individual.free_listing_count": 1,
        "individual.free_period_days": 365,
        "individual.free_publish_days": 30,
        "individual.paid_publish_days": 30,
        "individual.paid_entitlement_valid_days": 365,
        "media.private_base_image_limit": 1,
        "media.private_base_video_limit": 0,
        "media.upgraded_image_limit": 20,
        "media.upgraded_video_limit": 1,
        "media.broker_image_limit": 20,
        "media.broker_video_limit": 1,
    }


@pytest.mark.django_db
def test_public_settings_endpoint_does_not_require_authentication(client):
    response = client.get("/api/v1/platform/public-settings/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_public_settings_endpoint_reflects_updates_after_commit(
    client, django_capture_on_commit_callbacks, staff_user
):
    from platform_settings.services import update_setting

    with django_capture_on_commit_callbacks(execute=True):
        update_setting(key="individual.free_listing_count", value=36, actor=staff_user)

    response = client.get("/api/v1/platform/public-settings/")

    assert response.json()["settings"]["individual.free_listing_count"] == 36
    assert response.json()["settings_version"] == 2


@pytest.mark.django_db
def test_get_public_settings_only_queries_the_database_once_per_cache_fill(
    django_assert_num_queries,
):
    from platform_settings.services import get_public_settings

    get_public_settings()  # first call warms the cache

    with django_assert_num_queries(0):
        get_public_settings()


@pytest.mark.django_db
def test_public_settings_endpoint_publishes_the_active_finance_configuration(client):
    """Spec §2.1 and §17.5 (added by Phase 9).

    Spec §2.1: "Production UI must not display invented, hard-coded ...
    operational data", naming FinanceQuoteService among its examples. Spec
    §17.5: a staff change to the defaults "changes automatically affect boat
    cards and the finance page". /financing/ is a standalone route (§4.1) that a
    visitor can open with no listing, so the only honest way for it to show the
    platform's assumptions is for the server to send the real current ones.

    This publishes nothing new in kind: the same four values already ride on
    every eligible boat card in spec §18.5's finance block, on the same
    unauthenticated endpoint family. The three assumption values are decimal
    strings per spec §30.2; term_months and version are integers.
    """
    response = client.get("/api/v1/platform/public-settings/")

    assert response.status_code == 200
    assert response.json()["finance_configuration"] == {
        "version": 1,
        "annual_rate_percent": "5.0000",
        "term_months": 48,
        "down_payment_percent": "20.0000",
    }


@pytest.mark.django_db
def test_public_settings_endpoint_reports_no_finance_configuration_when_none_is_active(
    client,
):
    """The endpoint degrades, it never 500s. Phase 8's migration 0002 always
    seeds an active version, but a staff deletion in Django admin is reachable —
    the same degradation FinancePolicy.load() makes on the card path (Task 3).
    Task 10 renders an un-prefilled form on null rather than inventing numbers.
    """
    FinanceConfigurationVersion.objects.all().delete()
    FinanceConfigurationService._invalidate_cache()

    response = client.get("/api/v1/platform/public-settings/")

    assert response.status_code == 200
    assert response.json()["finance_configuration"] is None

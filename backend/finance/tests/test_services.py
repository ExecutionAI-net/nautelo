from decimal import Decimal

import pytest
from django.core.cache import cache

from finance.models import FinanceConfigurationVersion
from finance.services import ACTIVE_CONFIGURATION_CACHE_KEY, FinanceConfigurationService


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.delete(ACTIVE_CONFIGURATION_CACHE_KEY)
    yield
    cache.delete(ACTIVE_CONFIGURATION_CACHE_KEY)


@pytest.mark.django_db
def test_get_active_configuration_returns_seeded_default():
    config = FinanceConfigurationService.get_active_configuration()

    assert config.version == 1
    assert config.annual_rate_percent == Decimal("5.0000")
    assert config.term_months == 48
    assert config.down_payment_percent == Decimal("20.0000")


@pytest.mark.django_db
def test_get_active_configuration_is_cached_after_first_call(django_assert_num_queries):
    FinanceConfigurationService.get_active_configuration()

    with django_assert_num_queries(0):
        FinanceConfigurationService.get_active_configuration()


@pytest.mark.django_db
def test_activate_deactivates_previous_version_and_invalidates_cache(
    django_capture_on_commit_callbacks,
):
    FinanceConfigurationService.get_active_configuration()  # warms the cache with v1

    new_config = FinanceConfigurationVersion(
        annual_rate_percent=Decimal("6.00"),
        term_months=60,
        down_payment_percent=Decimal("25.00"),
    )

    with django_capture_on_commit_callbacks(execute=True):
        activated = FinanceConfigurationService.activate(new_config)

    assert activated.version == 2
    assert activated.is_active is True

    previous = FinanceConfigurationVersion.objects.get(version=1)
    assert previous.is_active is False

    assert cache.get(ACTIVE_CONFIGURATION_CACHE_KEY) is None
    refreshed = FinanceConfigurationService.get_active_configuration()
    assert refreshed.version == 2
    assert refreshed.annual_rate_percent == Decimal("6.0000")

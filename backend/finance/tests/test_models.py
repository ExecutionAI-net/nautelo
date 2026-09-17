from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from finance.models import FinanceConfigurationVersion


@pytest.mark.django_db
def test_only_one_active_configuration_version_allowed():
    # Defensive cleanup: makes this test correct both now (no rows exist yet)
    # and later once Task 2 seeds a default active row via migration.
    FinanceConfigurationVersion.objects.all().delete()

    FinanceConfigurationVersion.objects.create(
        version=1,
        annual_rate_percent=Decimal("5.00"),
        term_months=48,
        down_payment_percent=Decimal("20.00"),
        is_active=True,
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            FinanceConfigurationVersion.objects.create(
                version=2,
                annual_rate_percent=Decimal("6.00"),
                term_months=36,
                down_payment_percent=Decimal("15.00"),
                is_active=True,
            )


@pytest.mark.django_db
def test_multiple_inactive_configuration_versions_are_allowed():
    FinanceConfigurationVersion.objects.all().delete()

    FinanceConfigurationVersion.objects.create(
        version=1,
        annual_rate_percent=Decimal("5.00"),
        term_months=48,
        down_payment_percent=Decimal("20.00"),
        is_active=False,
    )
    FinanceConfigurationVersion.objects.create(
        version=2,
        annual_rate_percent=Decimal("6.00"),
        term_months=36,
        down_payment_percent=Decimal("15.00"),
        is_active=False,
    )

    assert FinanceConfigurationVersion.objects.filter(is_active=False).count() == 2

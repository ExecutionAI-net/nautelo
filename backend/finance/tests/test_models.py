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


def test_default_configuration_is_seeded_and_active(db):
    config = FinanceConfigurationVersion.objects.get(is_active=True)

    assert config.version == 1
    assert config.annual_rate_percent == Decimal("5.0000")
    assert config.term_months == 48
    assert config.down_payment_percent == Decimal("20.0000")


@pytest.mark.django_db
def test_save_on_existing_row_rejects_changes_to_immutable_fields():
    FinanceConfigurationVersion.objects.all().delete()

    config = FinanceConfigurationVersion.objects.create(
        version=1,
        annual_rate_percent=Decimal("5.00"),
        term_months=48,
        down_payment_percent=Decimal("20.00"),
        is_active=False,
    )

    config.annual_rate_percent = Decimal("7.50")

    with pytest.raises(ValueError):
        config.save()

    persisted = FinanceConfigurationVersion.objects.get(pk=config.pk)
    assert persisted.annual_rate_percent == Decimal("5.0000")


@pytest.mark.django_db
def test_save_on_existing_row_allows_is_active_to_change():
    FinanceConfigurationVersion.objects.all().delete()

    config = FinanceConfigurationVersion.objects.create(
        version=1,
        annual_rate_percent=Decimal("5.00"),
        term_months=48,
        down_payment_percent=Decimal("20.00"),
        is_active=True,
    )

    config.is_active = False
    config.save()

    persisted = FinanceConfigurationVersion.objects.get(pk=config.pk)
    assert persisted.is_active is False

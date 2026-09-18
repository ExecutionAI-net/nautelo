"""Exercises messaging/0002 itself (the autouse fixture in conftest.py rewrites
the flag row, so asserting on the row alone would prove nothing about the seed)."""

import importlib

import pytest
from django.apps import apps
from django.db import connection

from platform_settings.models import FeatureFlag

migration = importlib.import_module("messaging.migrations.0002_seed_unified_inquiries_flag")

pytestmark = pytest.mark.django_db


def _run_forward():
    migration.seed_flag(apps, connection.schema_editor)


@pytest.fixture(autouse=True)
def _empty_flag_table():
    FeatureFlag.objects.filter(key="unified_inquiries").delete()


def test_seed_creates_the_flag_disabled_with_a_fitting_description():
    _run_forward()
    flag = FeatureFlag.objects.get(key="unified_inquiries")
    assert flag.is_enabled is False
    assert 0 < len(flag.description) <= 255
    assert len(migration.FLAG_DESCRIPTION) <= 255
    assert migration.FLAG_KEY == "unified_inquiries"


def test_seed_is_idempotent_and_does_not_clobber_an_operator_toggle():
    _run_forward()
    FeatureFlag.objects.filter(key="unified_inquiries").update(
        is_enabled=True, description="operator text"
    )
    _run_forward()
    assert FeatureFlag.objects.filter(key="unified_inquiries").count() == 1
    flag = FeatureFlag.objects.get(key="unified_inquiries")
    assert flag.is_enabled is True
    assert flag.description == "operator text"


def test_reverse_is_a_noop_that_keeps_the_row():
    _run_forward()
    (operation,) = migration.Migration.operations
    assert operation.reverse_code is migration.migrations.RunPython.noop
    operation.reverse_code(apps, connection.schema_editor)
    assert FeatureFlag.objects.filter(key="unified_inquiries").exists()


def test_migration_runs_the_seed_and_depends_on_the_flag_table():
    (operation,) = migration.Migration.operations
    assert operation.code is migration.seed_flag
    assert ("platform_settings", "0004_featureflag") in migration.Migration.dependencies

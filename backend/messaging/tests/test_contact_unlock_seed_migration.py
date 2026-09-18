"""Exercises messaging/0004 itself.

conftest's `_messaging_reference_rows` rewrites the `contact_unlock` row before
every test, so asserting on the row alone would prove nothing about the seed —
exactly the mistake messaging/0002's own seed test avoids. Everything here runs
the migration's forward function against a table with no such row.
"""

import importlib

import pytest
from django.apps import apps
from django.db import connection

from messaging.enums import CONTACT_UNLOCK_FLAG
from platform_settings.models import FeatureFlag

migration = importlib.import_module("messaging.migrations.0004_seed_contact_unlock_flag")

pytestmark = pytest.mark.django_db


def _run_forward():
    migration.seed_flag(apps, connection.schema_editor)


@pytest.fixture(autouse=True)
def _empty_flag_table():
    FeatureFlag.objects.filter(key=CONTACT_UNLOCK_FLAG).delete()


def test_seed_creates_the_flag_disabled_with_a_fitting_description():
    _run_forward()
    flag = FeatureFlag.objects.get(key=CONTACT_UNLOCK_FLAG)
    assert flag.is_enabled is False
    assert 0 < len(flag.description) <= 255
    assert len(migration.FLAG_DESCRIPTION) <= 255
    assert migration.FLAG_KEY == CONTACT_UNLOCK_FLAG == "contact_unlock"


def test_seed_is_idempotent_and_does_not_clobber_an_operator_toggle():
    _run_forward()
    FeatureFlag.objects.filter(key=CONTACT_UNLOCK_FLAG).update(
        is_enabled=True, description="operator text"
    )
    _run_forward()
    assert FeatureFlag.objects.filter(key=CONTACT_UNLOCK_FLAG).count() == 1
    flag = FeatureFlag.objects.get(key=CONTACT_UNLOCK_FLAG)
    assert flag.is_enabled is True
    assert flag.description == "operator text"


def test_reverse_is_a_noop_that_keeps_the_row():
    _run_forward()
    (operation,) = migration.Migration.operations
    assert operation.reverse_code is migration.migrations.RunPython.noop
    operation.reverse_code(apps, connection.schema_editor)
    assert FeatureFlag.objects.filter(key=CONTACT_UNLOCK_FLAG).exists()


def test_migration_runs_the_seed_and_depends_on_phase_6_and_the_flag_table():
    (operation,) = migration.Migration.operations
    assert operation.code is migration.seed_flag
    assert ("messaging", "0003_message_contactaccessgrant") in (
        migration.Migration.dependencies
    )
    assert ("platform_settings", "0004_featureflag") in migration.Migration.dependencies

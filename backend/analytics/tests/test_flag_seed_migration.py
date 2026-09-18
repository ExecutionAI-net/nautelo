"""The `unique_listing_views` seed migration itself (spec §35.1, §35.2 step 4).

These tests call the migration's own `create_flag` / `delete_flag` functions
against the FeatureFlag table rather than reading the row the already-applied
migration left in the test database. A test that only read that row would still
pass if the migration were rewritten to seed the flag ENABLED, or made
non-idempotent, or made irreversible — so it would not be a test of anything the
migration has to get right. The one end-to-end assertion at the bottom exists to
prove the migration is actually wired into the graph at all.
"""

import importlib

import pytest

from analytics.recording import UNIQUE_LISTING_VIEWS_FLAG
from platform_settings.models import FeatureFlag

pytestmark = pytest.mark.django_db

migration = importlib.import_module(
    "analytics.migrations.0002_seed_unique_listing_views_flag"
)


@pytest.fixture
def apps():
    """The migration reads its model through `apps.get_model()`. For a RunPython
    that only creates a row with fields present in every historical version, the
    live registry is an honest stand-in for the historical one and keeps the test
    free of MigrationExecutor plumbing."""
    from django.apps import apps as live_apps

    return live_apps


def _forget_the_flag():
    """Undo the already-applied migration's row for this test's transaction."""
    FeatureFlag.objects.filter(key=UNIQUE_LISTING_VIEWS_FLAG).delete()


def test_the_seeded_key_is_the_one_the_recorder_reads():
    """Two spellings of the same key would seed a flag nothing consults."""
    assert migration.FLAG_KEY == UNIQUE_LISTING_VIEWS_FLAG


def test_the_migration_seeds_the_flag_disabled(apps):
    """Spec §35.2 step 4 ships the code with the feature OFF; step 9 turns it on.
    The three flags already in the repo (`listing_revisions`, `finance_estimates`,
    `individual_entitlements`) are all seeded the same way."""
    _forget_the_flag()

    migration.create_flag(apps, None)

    flag = FeatureFlag.objects.get(key=UNIQUE_LISTING_VIEWS_FLAG)
    assert flag.is_enabled is False
    assert flag.description == migration.FLAG_DESCRIPTION


def test_re_running_the_migration_does_not_clobber_an_operator_toggle(apps):
    """`get_or_create`, not `update_or_create`: once an operator has turned the
    flag on, re-running the seed (a replayed migration, a restored database) must
    not silently switch the feature back off in production."""
    _forget_the_flag()
    migration.create_flag(apps, None)
    FeatureFlag.objects.filter(key=UNIQUE_LISTING_VIEWS_FLAG).update(
        is_enabled=True, description="operator note"
    )

    migration.create_flag(apps, None)

    flag = FeatureFlag.objects.get(key=UNIQUE_LISTING_VIEWS_FLAG)
    assert flag.is_enabled is True
    assert flag.description == "operator note"
    assert FeatureFlag.objects.filter(key=UNIQUE_LISTING_VIEWS_FLAG).count() == 1


def test_the_migration_is_reversible(apps):
    migration.delete_flag(apps, None)
    assert not FeatureFlag.objects.filter(key=UNIQUE_LISTING_VIEWS_FLAG).exists()

    migration.create_flag(apps, None)
    assert FeatureFlag.objects.filter(key=UNIQUE_LISTING_VIEWS_FLAG).exists()

    assert migration.Migration.operations[0].reverse_code is migration.delete_flag


def test_the_description_fits_the_column(apps):
    """FeatureFlag.description is varchar(255); an over-long seed string would
    fail the migration on a real deployment, long after review."""
    max_length = FeatureFlag._meta.get_field("description").max_length
    assert len(migration.FLAG_DESCRIPTION) <= max_length

    _forget_the_flag()
    migration.create_flag(apps, None)
    FeatureFlag.objects.get(key=UNIQUE_LISTING_VIEWS_FLAG).full_clean()


def test_the_migration_depends_on_both_tables_it_touches():
    """It writes `platform_settings.FeatureFlag` and belongs to `analytics`, so it
    must be ordered after the migration that CREATES FeatureFlag — not merely
    after that app's current leaf."""
    assert ("analytics", "0001_listingview") in migration.Migration.dependencies
    assert ("platform_settings", "0004_featureflag") in migration.Migration.dependencies


def test_the_flag_exists_and_is_off_in_a_freshly_migrated_database():
    """End to end: the migration is in the graph and ran. This is what makes the
    `test_recording.py` flag-off test meaningful — it asserts the shipped default,
    and the shipped default comes from here."""
    assert (
        FeatureFlag.objects.get(key=UNIQUE_LISTING_VIEWS_FLAG).is_enabled is False
    )

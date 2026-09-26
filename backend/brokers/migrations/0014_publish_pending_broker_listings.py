"""Publish the broker listings that were waiting for a moderator.

Product decision 2026-09-26: an ACTIVE brokerage's listings go live without
moderation (listings.policies.requires_staff_approval). Submissions that were
already queued under the old rule are published once here, through the same
approve_revision() path a moderator's APPROVE takes, so every one is
re-validated and a snapshot is created exactly as before. Each runs in its own
savepoint: a revision that no longer validates stays pending for staff, the
rest still publish.

Uses the real models and service on purpose (the historical models cannot
publish); on a fresh database there is nothing to do.
"""

from django.db import migrations, transaction

NOTE = "Broker listings no longer need moderation (2026-09-26)."


def publish_pending(apps, schema_editor):
    from brokers.enums import BrokerOrganizationStatus
    from listings.decisions import approve_revision
    from listings.enums import RevisionStatus
    from listings.models import ListingRevision

    pending = list(
        ListingRevision.objects.filter(
            state=RevisionStatus.SUBMITTED,
            listing__seller_type="BROKER",
            listing__deleted_at__isnull=True,
            listing__broker__status=BrokerOrganizationStatus.ACTIVE,
        )
        .select_related("listing")
        .values_list("pk", "version", "submitted_by_id", "listing__created_by_id")
    )
    for revision_id, version, submitted_by_id, created_by_id in pending:
        from accounts.models import User

        actor = User.objects.filter(pk=submitted_by_id or created_by_id).first()
        try:
            with transaction.atomic():
                approve_revision(revision_id=revision_id, actor=actor, expected_version=version, note=NOTE)
        except Exception as exc:  # noqa: BLE001 - one bad revision must not block the rest
            print(f"  kept pending {revision_id}: {exc}")


class Migration(migrations.Migration):
    dependencies = [
        ("brokers", "0013_seed_broker_roles"),
        ("listings", "0013_boatlisting_deleted_at"),
    ]

    operations = [migrations.RunPython(publish_pending, migrations.RunPython.noop)]

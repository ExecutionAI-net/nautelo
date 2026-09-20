from django.db import migrations


def mark_owners(apps, schema_editor):
    Membership = apps.get_model("brokers", "BrokerMembership")
    owned = set(Membership.objects.filter(is_owner=True).values_list("broker_id", flat=True))
    seen = set(owned)
    for seat in Membership.objects.filter(role="ADMIN", is_active=True).order_by("created_at"):
        if seat.broker_id in seen:
            continue
        seen.add(seat.broker_id)
        seat.is_owner = True
        seat.save(update_fields=["is_owner"])


class Migration(migrations.Migration):
    dependencies = [("brokers", "0008_membership_owner")]
    operations = [migrations.RunPython(mark_owners, migrations.RunPython.noop)]

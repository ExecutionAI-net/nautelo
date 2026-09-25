from django.db import migrations

# Customer feedback (2026-09-25): the role a registering owner holds within
# their own brokerage, offered as a dropdown at registration.
ROLES = [
    {"slug": "administrator", "name": "Administrator", "display_order": 10},
    {"slug": "ceo", "name": "CEO", "display_order": 20},
    {"slug": "sales", "name": "Sales", "display_order": 30},
    {"slug": "manager", "name": "Manager", "display_order": 40},
    {"slug": "junior-broker", "name": "Junior Broker", "display_order": 50},
    {"slug": "senior-broker", "name": "Senior Broker", "display_order": 60},
    {"slug": "head-broker", "name": "Head Broker", "display_order": 70},
]


def seed_roles(apps, schema_editor):
    BrokerRole = apps.get_model("brokers", "BrokerRole")
    for entry in ROLES:
        BrokerRole.objects.get_or_create(
            slug=entry["slug"],
            defaults={"name": entry["name"], "display_order": entry["display_order"], "is_active": True},
        )


class Migration(migrations.Migration):
    dependencies = [("brokers", "0012_broker_role_trading_name_verification_docs")]

    operations = [
        # Reverse is a deliberate no-op: staff-editable editorial content, same
        # rationale as services_catalog's category seeds.
        migrations.RunPython(seed_roles, migrations.RunPython.noop),
    ]

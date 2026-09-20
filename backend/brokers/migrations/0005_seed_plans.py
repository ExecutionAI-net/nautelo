from decimal import Decimal

from django.db import migrations

# The three tiers of the approved design: listing limit, team seats and profile placement.
PLANS = [
    ("boutique-broker", "Boutique Broker", "For independent maritime brokers and bespoke charter consultants.", "290", 5, 2, 0, 1),
    ("premier-fleet", "Premier Fleet", "For established agencies operating primary berths across Spain and Italy.", "890", 25, 10, 1, 2),
    ("sovereign-agency", "Sovereign Agency", "For international superyacht brokerages and multijurisdictional fleets.", "1850", None, None, 2, 3),
]


def seed(apps, schema_editor):
    BrokerPlan = apps.get_model("brokers", "BrokerPlan")
    for slug, name, tagline, price, listings, seats, visibility, order in PLANS:
        BrokerPlan.objects.update_or_create(
            slug=slug,
            defaults={
                "name": name, "tagline": tagline, "monthly_price": Decimal(price), "listing_limit": listings,
                "seat_limit": seats, "profile_visibility": visibility, "display_order": order, "is_active": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [("brokers", "0004_broker_plans")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]

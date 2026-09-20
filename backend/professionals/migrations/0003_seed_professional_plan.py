from django.db import migrations


def seed(apps, schema_editor):
    Plan = apps.get_model("professionals", "ProfessionalPlan")
    Plan.objects.get_or_create(
        slug="professional-membership",
        defaults={
            "name": "Professional membership",
            "tagline": "Get your services listed in the NAUTA directory. Billed monthly.",
            "monthly_price": 49,
            "currency": "EUR",
            "is_active": False,
        },
    )


class Migration(migrations.Migration):
    dependencies = [("professionals", "0002_subscriptions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]

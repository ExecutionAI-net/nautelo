from decimal import Decimal

from django.db import migrations


def create_default_configuration(apps, schema_editor):
    FinanceConfigurationVersion = apps.get_model("finance", "FinanceConfigurationVersion")
    FinanceConfigurationVersion.objects.create(
        version=1,
        annual_rate_percent=Decimal("5.00"),
        term_months=48,
        down_payment_percent=Decimal("20.00"),
        is_active=True,
        created_by_user_id=None,
    )


def remove_default_configuration(apps, schema_editor):
    FinanceConfigurationVersion = apps.get_model("finance", "FinanceConfigurationVersion")
    FinanceConfigurationVersion.objects.filter(version=1).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0001_initial"),
    ]
    operations = [
        migrations.RunPython(create_default_configuration, remove_default_configuration),
    ]

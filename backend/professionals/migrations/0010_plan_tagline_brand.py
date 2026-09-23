"""The seeded professional plan tagline still named the retired brand."""

from django.db import migrations


def rename(apps, schema_editor):
    Plan = apps.get_model("professionals", "ProfessionalPlan")
    for plan in Plan.objects.filter(tagline__icontains="nauta"):
        plan.tagline = plan.tagline.replace("NAUTA directory", "Nautelo directory").replace("NAUTA", "Nautelo").replace("Nauta ", "Nautelo ")
        plan.save(update_fields=["tagline"])


class Migration(migrations.Migration):
    dependencies = [("professionals", "0009_subscription_cancel_at_period_end")]
    operations = [migrations.RunPython(rename, migrations.RunPython.noop)]

from django.db import migrations

PLANS = [
    ("week", "1 week", "1 settimana", "1 semana", 7, "99.00", False, 1),
    ("two-weeks", "2 weeks", "2 settimane", "2 semanas", 14, "149.00", True, 2),
    ("month", "1 month", "1 mese", "1 mes", 30, "199.00", False, 3),
]


def create_plans(apps, schema_editor):
    Plan = apps.get_model("promotions", "PromotionPlan")
    for code, en, it, es, days, price, popular, order in PLANS:
        Plan.objects.get_or_create(
            code=code,
            defaults={"name_en": en, "name_it": it, "name_es": es, "days": days, "price": price, "is_popular": popular, "display_order": order},
        )


class Migration(migrations.Migration):
    dependencies = [("promotions", "0001_initial")]
    operations = [migrations.RunPython(create_plans, migrations.RunPython.noop)]

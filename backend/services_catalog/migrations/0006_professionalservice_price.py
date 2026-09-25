# Hand-written: psycopg's bundled libpq.dll is blocked by a Windows
# Application Control policy in this environment, so `makemigrations` could
# not be run locally. Mirrors the model fields added to ProfessionalService.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services_catalog', '0005_legacydirectorymapping'),
    ]

    operations = [
        migrations.AddField(
            model_name='professionalservice',
            name='price_from',
            field=models.DecimalField(decimal_places=2, max_digits=10, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='professionalservice',
            name='pricing_note',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
    ]

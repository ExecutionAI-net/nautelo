# Hand-written: psycopg's bundled libpq.dll is blocked by a Windows
# Application Control policy in this environment, so `makemigrations` could
# not be run locally. Mirrors the model field added to ProfessionalService.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services_catalog', '0006_professionalservice_price'),
    ]

    operations = [
        migrations.AddField(
            model_name='professionalservice',
            name='photo_key',
            field=models.CharField(blank=True, default='', max_length=300),
        ),
    ]

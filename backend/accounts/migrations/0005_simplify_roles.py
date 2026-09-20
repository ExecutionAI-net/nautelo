from django.db import migrations, models


def forwards(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(primary_role="BUYER").update(primary_role="PRIVATE_SELLER")
    User.objects.filter(primary_role="SERVICE_PROVIDER").update(primary_role="PROFESSIONAL")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0004_password_reset_token")]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="primary_role",
            field=models.CharField(
                choices=[
                    ("PRIVATE_SELLER", "Private seller"),
                    ("BROKER", "Broker"),
                    ("PROFESSIONAL", "Professional"),
                    ("STAFF", "Staff"),
                ],
                default="PRIVATE_SELLER",
                max_length=20,
            ),
        ),
    ]

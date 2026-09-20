import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import Q


def backfill(apps, schema_editor):
    Profile = apps.get_model("professionals", "ProfessionalProfile")
    Membership = apps.get_model("professionals", "ProfessionalMembership")
    for profile in Profile.objects.all():
        Membership.objects.get_or_create(
            profile=profile,
            user_id=profile.owner_user_id,
            defaults={
                "role": "ADMIN",
                "is_owner": True,
                "can_edit_profile": True,
                "can_manage_team": True,
                "can_read_messages": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("professionals", "0003_seed_professional_plan"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProfessionalMembership",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "role",
                    models.CharField(
                        choices=[("ADMIN", "Admin"), ("MANAGER", "Manager"), ("AGENT", "Agent"), ("VIEWER", "Viewer")],
                        default="VIEWER",
                        max_length=10,
                    ),
                ),
                ("can_edit_profile", models.BooleanField(default=False)),
                ("can_manage_team", models.BooleanField(default=False)),
                ("can_read_messages", models.BooleanField(default=False)),
                ("is_owner", models.BooleanField(default=False)),
                ("show_on_profile", models.BooleanField(default=True)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="memberships",
                        to="professionals.professionalprofile",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="professional_memberships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ("-is_owner", "user__full_name", "user__email")},
        ),
        migrations.AddConstraint(
            model_name="professionalmembership",
            constraint=models.UniqueConstraint(
                fields=("user", "profile"), name="professionals_membership_unique_user_profile"
            ),
        ),
        migrations.AddConstraint(
            model_name="professionalmembership",
            constraint=models.UniqueConstraint(
                condition=Q(is_active=True), fields=("user",), name="professionals_one_live_membership_per_user"
            ),
        ),
        migrations.AddConstraint(
            model_name="professionalmembership",
            constraint=models.CheckConstraint(
                condition=~Q(role="ADMIN") | Q(can_edit_profile=True, can_manage_team=True, can_read_messages=True),
                name="professionals_admin_membership_has_all_permissions",
            ),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]

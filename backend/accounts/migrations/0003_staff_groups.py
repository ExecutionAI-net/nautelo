from django.db import migrations

# Frozen literals on purpose: a migration must describe the database as it was
# at the time it was written, so it must not import accounts.enums.StaffGroup -
# renaming that constant later would silently rewrite history.
STAFF_GROUP_NAMES = ("staff_moderator", "staff_admin")


def create_staff_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    for name in STAFF_GROUP_NAMES:
        Group.objects.get_or_create(name=name)


def delete_staff_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name__in=STAFF_GROUP_NAMES).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_emailverificationtoken"),
        ("auth", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_staff_groups, delete_staff_groups),
    ]

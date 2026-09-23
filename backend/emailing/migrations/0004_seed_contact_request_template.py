"""Seeds the EN template of the team-mailbox announcement for every public
form submission (contactdesk.tasks). Staff can edit it from the template editor."""

from django.db import migrations

SUBJECT = "New {{ topic }} request from {{ name }} ({{ reference }})"
HTML = (
    "<h1 style=\"margin:0 0 16px;font-size:22px;\">New {{ topic }} request</h1>"
    "<p style=\"margin:0 0 12px;\">{{ name }} ({{ email }}, {{ phone }}) wrote through the website. Reply language: {{ language }}.</p>"
    "<p style=\"margin:0 0 12px;padding:16px;background:#f4f1ea;border-radius:6px;color:#3a3f3f;white-space:pre-wrap;\">{{ message }}</p>"
    "<p style=\"margin:0 0 12px;white-space:pre-wrap;\">{{ details }}</p>"
    "<p style=\"margin:0 0 12px;\">Reference {{ reference }}.</p>"
    "<div style=\"text-align:center;margin:28px 0;\">"
    "<a href=\"{{ url }}\" style=\"background:#00696e;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 32px;border-radius:6px;display:inline-block;\">Open the contact desk</a>"
    "</div>"
)


def seed(apps, schema_editor):
    EmailTemplate = apps.get_model("emailing", "EmailTemplate")
    EmailTemplate.objects.update_or_create(
        key="contact_request_received", locale="EN", defaults={"subject": SUBJECT, "html_body": HTML}
    )


def remove(apps, schema_editor):
    apps.get_model("emailing", "EmailTemplate").objects.filter(key="contact_request_received").delete()


class Migration(migrations.Migration):
    dependencies = [("emailing", "0003_seed_phase4_templates")]
    operations = [migrations.RunPython(seed, remove)]

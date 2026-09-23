"""Seeds the EN body for the two emails accounts/tasks.py already sends, so a
fresh environment gets the branded HTML look immediately instead of shipping
with an empty table (render_email() falls back to the old plain-text body
when a row is missing, so this is a nice-to-have seed, not a correctness
requirement)."""

from django.db import migrations

CTA_BUTTON = (
    '<div style="text-align:center;margin:28px 0;">'
    '<a href="{{{{ url }}}}" style="background:#00696e;color:#ffffff;text-decoration:none;'
    "font-weight:700;padding:14px 32px;border-radius:6px;display:inline-block;\">{label}</a>"
    "</div>"
)

TEMPLATES = [
    (
        "email_verification",
        "EN",
        "Confirm your Nautelo email address",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Confirm Your Email</h1>"
            "<p style=\"margin:0 0 12px;\">Hi {{ name }},</p>"
            "<p style=\"margin:0 0 12px;\">Welcome to Nautelo. Confirm your email address to activate your account.</p>"
            + CTA_BUTTON.format(label="Confirm Email")
            + "<p style=\"margin:24px 0 0;font-size:13px;color:#5f6b6c;\">This link will expire in 24 hours for security reasons.</p>"
        ),
    ),
    (
        "password_reset",
        "EN",
        "Reset your Nautelo password",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Reset Your Password</h1>"
            "<p style=\"margin:0 0 12px;\">Hi {{ name }},</p>"
            "<p style=\"margin:0 0 12px;\">We received a request to reset your Nautelo account password. "
            "Click the button below to create a new password.</p>"
            + CTA_BUTTON.format(label="Reset Password")
            + "<p style=\"margin:24px 0 0;font-size:13px;color:#5f6b6c;\">This link will expire in 1 hour for security reasons.</p>"
            "<hr style=\"border:none;border-top:1px solid #e7e2d8;margin:24px 0;\">"
            "<p style=\"margin:0;font-size:13px;color:#5f6b6c;\">If you didn't request a password reset, you can safely ignore this email.</p>"
        ),
    ),
]


def seed_templates(apps, schema_editor):
    EmailTemplate = apps.get_model("emailing", "EmailTemplate")
    for key, locale, subject, html_body in TEMPLATES:
        EmailTemplate.objects.update_or_create(
            key=key, locale=locale, defaults={"subject": subject, "html_body": html_body}
        )


def remove_templates(apps, schema_editor):
    EmailTemplate = apps.get_model("emailing", "EmailTemplate")
    EmailTemplate.objects.filter(key__in=[key for key, *_ in TEMPLATES], locale="EN").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("emailing", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_templates, remove_templates),
    ]

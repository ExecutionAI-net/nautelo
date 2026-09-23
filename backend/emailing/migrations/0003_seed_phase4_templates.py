"""Seeds EN default HTML for the 15 notification-driven templates added in
Phase 4 (see notifications/tasks.py's TEMPLATE_KEY_BY_TYPE), so a fresh
environment gets the branded HTML look immediately instead of an empty table.
render_email() falls back to the existing plain-text copy when a row is
missing, so this is a nice-to-have seed, not a correctness requirement -
staff can edit every one of these from the Phase 2 editor at any time."""

from django.db import migrations

CTA_BUTTON = (
    '<div style="text-align:center;margin:28px 0;">'
    '<a href="{{{{ url }}}}" style="background:#00696e;color:#ffffff;text-decoration:none;'
    "font-weight:700;padding:14px 32px;border-radius:6px;display:inline-block;\">{label}</a>"
    "</div>"
)

TEMPLATES = [
    (
        "new_message",
        "New message on Nautelo",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">You Have a New Message</h1>"
            "<p style=\"margin:0 0 12px;\">{{ sender }} sent you a message about {{ context }} on Nautelo.</p>"
            "<p style=\"margin:0 0 12px;padding:16px;background:#f4f1ea;border-radius:6px;color:#3a3f3f;\">{{ excerpt }}</p>"
            + CTA_BUTTON.format(label="Read and Reply")
            + "<p style=\"margin:24px 0 0;font-size:13px;color:#5f6b6c;\">Reply through Nautelo so the conversation stays on the platform.</p>"
        ),
    ),
    (
        "listing_submission_received",
        "Your listing was submitted",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Your Listing Was Submitted</h1>"
            "<p style=\"margin:0 0 12px;\">Thanks for listing your vessel on Nautelo. It was received and is awaiting staff review.</p>"
            + CTA_BUTTON.format(label="View Your Listings")
        ),
    ),
    (
        "listing_approved",
        "Your listing was approved",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Your Listing Is Live</h1>"
            "<p style=\"margin:0 0 12px;\">Good news - your listing is now public on Nautelo.</p>"
            + CTA_BUTTON.format(label="View Your Listings")
        ),
    ),
    (
        "listing_changes_requested",
        "Changes requested on your listing",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Changes Requested</h1>"
            "<p style=\"margin:0 0 12px;\">A moderator asked for changes to your listing before it can be published.</p>"
            + CTA_BUTTON.format(label="Review and Update")
        ),
    ),
    (
        "listing_rejected",
        "Your listing was rejected",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Your Listing Was Rejected</h1>"
            "<p style=\"margin:0 0 12px;\">A moderator rejected your listing. Sign in to see the details.</p>"
            + CTA_BUTTON.format(label="View Your Listings")
        ),
    ),
    (
        "listing_expiring",
        "Your listing is about to expire",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Your Listing Is About to Expire</h1>"
            "<p style=\"margin:0 0 12px;\">Buy a paid listing to extend it and unlock 20 photos and a video, or it leaves the marketplace.</p>"
            + CTA_BUTTON.format(label="Extend Your Listing")
        ),
    ),
    (
        "listing_expired",
        "Your listing has expired",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Your Listing Has Expired</h1>"
            "<p style=\"margin:0 0 12px;\">It is no longer public on Nautelo.</p>"
            + CTA_BUTTON.format(label="View Your Listings")
        ),
    ),
    (
        "broker_trial_started",
        "Your free trial has started",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Your Free Trial Has Started</h1>"
            "<p style=\"margin:0 0 12px;\">Your brokerage plan is set. Staff approval is what puts your brokerage live.</p>"
            + CTA_BUTTON.format(label="Go to Your Dashboard")
        ),
    ),
    (
        "broker_payment_failed",
        "Payment not received",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Payment Not Received</h1>"
            "<p style=\"margin:0 0 12px;\">We could not collect your brokerage subscription. Pay within 24 hours to keep your brokerage online.</p>"
            + CTA_BUTTON.format(label="Update Payment")
        ),
    ),
    (
        "broker_suspended",
        "Your brokerage is suspended",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Your Brokerage Is Suspended</h1>"
            "<p style=\"margin:0 0 12px;\">The subscription is not active, so your vessels are offline. Pay to bring them back.</p>"
            + CTA_BUTTON.format(label="Reactivate")
        ),
    ),
    (
        "payment_fulfilled",
        "Your purchase is ready",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Your Purchase Is Ready</h1>"
            "<p style=\"margin:0 0 12px;\">Your payment was received and applied.</p>"
            + CTA_BUTTON.format(label="View Details")
        ),
    ),
    (
        "professional_activated",
        "Your professional profile is live",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Your Professional Profile Is Live</h1>"
            "<p style=\"margin:0 0 12px;\">Your payment was received. Your profile is now listed on Nautelo.</p>"
            + CTA_BUTTON.format(label="View Your Profile")
        ),
    ),
    (
        "professional_payment_failed",
        "Payment not received",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Payment Not Received</h1>"
            "<p style=\"margin:0 0 12px;\">We could not collect your monthly membership. Pay within 24 hours to keep your profile online.</p>"
            + CTA_BUTTON.format(label="Update Payment")
        ),
    ),
    (
        "professional_deactivated",
        "Your professional profile is offline",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">Your Professional Profile Is Offline</h1>"
            "<p style=\"margin:0 0 12px;\">Your membership is not active, so your profile is no longer listed. Pay to bring it back.</p>"
            + CTA_BUTTON.format(label="Reactivate")
        ),
    ),
    (
        "payment_fulfillment_failed",
        "Payment needs staff attention",
        (
            "<h1 style=\"margin:0 0 16px;font-size:22px;\">We Need to Check Your Payment</h1>"
            "<p style=\"margin:0 0 12px;\">A payment could not be fulfilled automatically. Our team has been notified and will follow up.</p>"
        ),
    ),
]


def seed_templates(apps, schema_editor):
    EmailTemplate = apps.get_model("emailing", "EmailTemplate")
    for key, subject, html_body in TEMPLATES:
        EmailTemplate.objects.update_or_create(
            key=key, locale="EN", defaults={"subject": subject, "html_body": html_body}
        )


def remove_templates(apps, schema_editor):
    EmailTemplate = apps.get_model("emailing", "EmailTemplate")
    EmailTemplate.objects.filter(
        key__in=[key for key, *_ in TEMPLATES], locale="EN"
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("emailing", "0002_seed_default_templates"),
    ]

    operations = [
        migrations.RunPython(seed_templates, remove_templates),
    ]

"""Admin-editable transactional email templates.

One row per (key, locale). `key` is a plain CharField, not a DB choices
constraint, so adding a new template a trigger site wants never needs a
migration - only a new row (seeded or authored by staff) and, in the
trigger's own code, a call to `emailing.services.render_email(key, ...)`.
`TEMPLATE_KEYS` in this module is the catalogue the staff editor and the
render lookup validate against; it is the source of truth for "what
templates exist", the DB rows are just their content.
"""

from django.conf import settings
from django.db import models

from common.models import UUIDTimeStampedModel

#: (key, label, available variables). Variables are documented here, not
#: enforced - `render_email()` renders whatever the stored body references
#: and silently leaves an unknown `{{ var }}` blank, same as Django's own
#: template engine does for a missing context key.
TEMPLATE_KEYS = (
    ("email_verification", "Email verification", ("name", "url")),
    ("password_reset", "Password reset", ("name", "url")),
    ("new_message", "New message received", ("sender", "context", "excerpt", "url")),
    ("listing_approved", "Listing approved", ("url",)),
    ("listing_changes_requested", "Listing: changes requested", ("url",)),
    ("listing_rejected", "Listing rejected", ("url",)),
    ("listing_expiring", "Listing expiring soon", ("url",)),
    ("listing_expired", "Listing expired", ("url",)),
    ("broker_trial_started", "Broker trial started", ("url",)),
    ("broker_payment_failed", "Broker payment failed", ("url",)),
    ("broker_suspended", "Broker suspended", ("url",)),
    ("payment_fulfilled", "Purchase fulfilled", ("url",)),
    ("professional_activated", "Professional membership active", ("url",)),
    ("professional_payment_failed", "Professional payment failed", ("url",)),
    ("professional_deactivated", "Professional profile deactivated", ("url",)),
    ("payment_fulfillment_failed", "Payment fulfillment failed", ("url",)),
)

TEMPLATE_KEY_CHOICES = tuple((key, label) for key, label, _variables in TEMPLATE_KEYS)


class EmailTemplate(UUIDTimeStampedModel):
    key = models.CharField(max_length=64)
    locale = models.CharField(max_length=2)
    subject = models.CharField(max_length=200)
    html_body = models.TextField(help_text="Rendered inside the shared Nautelo header/hero/footer layout.")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["key", "locale"], name="emailing_one_template_per_key_and_locale"),
        ]
        ordering = ("key", "locale")

    def __str__(self):
        return f"{self.key} ({self.locale})"

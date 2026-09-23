"""Notification vocabulary (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md 11.10, 27.1)."""

from django.db import models


class NotificationType(models.TextChoices):
    """Spec 27.1's event names, verbatim and dotted.

    Only the event this phase produces is declared. Phase 18 appends the other
    ten from 27.1's table; appending a member is additive and needs no
    migration, because `notification_type` is a plain CharField (choices are a
    Django-level validation, not a database enum).
    """

    INQUIRY_RECEIVED = "inquiry.received", "Inquiry received"
    LISTING_INITIAL_SUBMITTED = "listing.initial_submitted", "Listing submitted"
    LISTING_REVISION_SUBMITTED = "listing.revision_submitted", "Revision submitted"
    LISTING_OTHER_MODEL_SUBMITTED = (
        "listing.other_model_submitted",
        "Other model submitted",
    )
    LISTING_APPROVED = "listing.approved", "Listing approved"
    LISTING_CHANGES_REQUESTED = "listing.changes_requested", "Changes requested"
    LISTING_REJECTED = "listing.rejected", "Listing rejected"
    LISTING_EXPIRING = "listing.expiring", "Listing expiring"
    LISTING_EXPIRED = "listing.expired", "Listing expired"
    BROKER_TRIAL_STARTED = "broker.trial_started", "Broker trial started"
    BROKER_PAYMENT_FAILED = "broker.payment_failed", "Broker payment failed"
    BROKER_SUSPENDED = "broker.suspended", "Broker suspended"
    PAYMENT_FULFILLED = "payment.fulfilled", "Payment fulfilled"
    PROFESSIONAL_ACTIVATED = "professional.activated", "Professional membership active"
    PROFESSIONAL_PAYMENT_FAILED = "professional.payment_failed", "Professional payment failed"
    PROFESSIONAL_DEACTIVATED = "professional.deactivated", "Professional profile offline"
    PAYMENT_FULFILLMENT_FAILED = (
        "payment.fulfillment_failed",
        "Payment fulfillment failed",
    )


class DeliveryChannel(models.TextChoices):
    IN_APP = "IN_APP", "In-app"
    WEBSOCKET = "WEBSOCKET", "WebSocket"
    EMAIL = "EMAIL", "Email"


class DeliveryStatus(models.TextChoices):
    QUEUED = "QUEUED", "Queued"
    SENT = "SENT", "Sent"
    FAILED = "FAILED", "Failed"
    SKIPPED = "SKIPPED", "Skipped"


#: Spec 27.1's channel column. `listing.expiring` is the only event without a
#: WebSocket push (it is a slow, date-driven reminder, not a live event).
NO_WEBSOCKET_TYPES = frozenset({NotificationType.LISTING_EXPIRING})


class NotificationCategory(models.TextChoices):
    """The dashboard's "Notifications" settings page groups NotificationType's
    17 events into these 3, since nobody wants a checkbox per event. A type
    absent from CATEGORY_BY_TYPE (the three staff moderation-queue events)
    has no user-facing toggle at all - they go to internal staff, not the
    person the notification is about, and are not opted out of here."""

    MESSAGES = "messages", "Messages"
    LISTINGS = "listings", "Listing updates"
    BILLING = "billing", "Billing & account status"


CATEGORY_BY_TYPE = {
    NotificationType.INQUIRY_RECEIVED: NotificationCategory.MESSAGES,
    NotificationType.LISTING_APPROVED: NotificationCategory.LISTINGS,
    NotificationType.LISTING_CHANGES_REQUESTED: NotificationCategory.LISTINGS,
    NotificationType.LISTING_REJECTED: NotificationCategory.LISTINGS,
    NotificationType.LISTING_EXPIRING: NotificationCategory.LISTINGS,
    NotificationType.LISTING_EXPIRED: NotificationCategory.LISTINGS,
    NotificationType.BROKER_TRIAL_STARTED: NotificationCategory.BILLING,
    NotificationType.BROKER_PAYMENT_FAILED: NotificationCategory.BILLING,
    NotificationType.BROKER_SUSPENDED: NotificationCategory.BILLING,
    NotificationType.PAYMENT_FULFILLED: NotificationCategory.BILLING,
    NotificationType.PROFESSIONAL_ACTIVATED: NotificationCategory.BILLING,
    NotificationType.PROFESSIONAL_PAYMENT_FAILED: NotificationCategory.BILLING,
    NotificationType.PROFESSIONAL_DEACTIVATED: NotificationCategory.BILLING,
    NotificationType.PAYMENT_FULFILLMENT_FAILED: NotificationCategory.BILLING,
}

#: Spec 27.3's "safe summary" / 15.4's "safe excerpt", capped so a notification
#: payload never becomes a second copy of the whole message body. The cap is
#: applied by the CALLER that builds the payload (Task 5's messaging service),
#: which is the only place that holds the full body; it is published here
#: because the notification payload is what the cap protects.
EXCERPT_MAX_LENGTH = 200

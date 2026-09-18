"""Conversation store (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md 11.8).

Every foreign key to another app is declared as a STRING ("brokers.BrokerOrganization"),
which Django resolves lazily. That keeps this module free of Python imports from
brokers/professionals/listings, so the dependency arrow stays one-directional and
`messaging` can never become part of an app-loading cycle.
"""

from django.conf import settings
from django.db import models

from common.models import UUIDTimeStampedModel
from messaging.enums import SUBJECT_MAX_LENGTH, ConversationStatus, ConversationType


class Conversation(UUIDTimeStampedModel):
    conversation_type = models.CharField(
        max_length=20, choices=ConversationType.choices
    )
    initiator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="initiated_conversations",
        on_delete=models.CASCADE,
    )
    broker = models.ForeignKey(
        "brokers.BrokerOrganization",
        related_name="conversations",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    professional = models.ForeignKey(
        "professionals.ProfessionalProfile",
        related_name="conversations",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    listing = models.ForeignKey(
        "listings.BoatListing",
        related_name="conversations",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    # Beyond spec 11.8's field list; see the plan's ruling. Spec 15.1 makes
    # Subject a required, validated 3-150 character field and 11.8 gives it
    # nowhere to live, so it lives on the thread it titles.
    subject = models.CharField(max_length=SUBJECT_MAX_LENGTH)
    status = models.CharField(
        max_length=10,
        choices=ConversationStatus.choices,
        default=ConversationStatus.OPEN,
    )
    last_message_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-last_message_at", "-created_at")
        indexes = [
            models.Index(fields=["initiator", "-last_message_at"]),
            models.Index(fields=["broker", "-last_message_at"]),
            models.Index(fields=["professional", "-last_message_at"]),
            models.Index(fields=["listing", "-last_message_at"]),
        ]
        constraints = [
            # Spec 11.8: "Exactly one valid context combination is permitted."
            # A LISTING_INQUIRY carries a listing and MAY also carry the broker
            # that owns it, because that broker is the recipient (11.8: "may
            # derive its recipient from listing ownership"). It never carries a
            # professional.
            models.CheckConstraint(
                condition=(
                    models.Q(
                        conversation_type=ConversationType.LISTING_INQUIRY,
                        listing__isnull=False,
                        professional__isnull=True,
                    )
                    | models.Q(
                        conversation_type=ConversationType.BROKER_INQUIRY,
                        broker__isnull=False,
                        listing__isnull=True,
                        professional__isnull=True,
                    )
                    | models.Q(
                        conversation_type=ConversationType.PROFESSIONAL_INQUIRY,
                        professional__isnull=False,
                        broker__isnull=True,
                        listing__isnull=True,
                    )
                    | models.Q(
                        conversation_type=ConversationType.SUPPORT,
                        broker__isnull=True,
                        professional__isnull=True,
                        listing__isnull=True,
                    )
                ),
                name="messaging_conversation_exactly_one_context",
            ),
            # One OPEN thread per (initiator, context). Partial, because an
            # ARCHIVED thread must not stop a new one - spec 15.3 step 2 says
            # "get or create an OPEN conversation". Three separate indexes
            # rather than one over all three FKs, because PostgreSQL treats
            # NULLs as distinct and a single composite index would never fire
            # on rows where two of the three are NULL. For the same reason the
            # `broker__isnull=False` clause below is documentation only.
            # NOTE: the database cannot tell ARCHIVED from BLOCKED, so it lets
            # a BLOCKED thread be superseded by a new OPEN one. Spec 36.6 says
            # blocking "prevents new messages": the service layer (Task 6's
            # submit / post_reply) MUST refuse to post into or supersede a
            # BLOCKED thread explicitly.
            models.UniqueConstraint(
                fields=["initiator", "listing"],
                condition=models.Q(
                    status=ConversationStatus.OPEN, listing__isnull=False
                ),
                name="messaging_open_listing_thread_unique",
            ),
            models.UniqueConstraint(
                fields=["initiator", "broker"],
                condition=models.Q(
                    status=ConversationStatus.OPEN,
                    broker__isnull=False,
                    listing__isnull=True,
                ),
                name="messaging_open_broker_thread_unique",
            ),
            models.UniqueConstraint(
                fields=["initiator", "professional"],
                condition=models.Q(
                    status=ConversationStatus.OPEN, professional__isnull=False
                ),
                name="messaging_open_professional_thread_unique",
            ),
        ]

    def __str__(self):
        return f"{self.conversation_type} {self.pk}"

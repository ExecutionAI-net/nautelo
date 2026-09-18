"""Conversation store (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md 11.8).

Every foreign key to another app is declared as a STRING ("brokers.BrokerOrganization"),
which Django resolves lazily. That keeps this module free of Python imports from
brokers/professionals/listings, so the dependency arrow stays one-directional and
`messaging` can never become part of an app-loading cycle.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import UUIDTimeStampedModel
from messaging.enums import (
    FULL_NAME_MAX_LENGTH,
    MESSAGE_MAX_LENGTH,
    PHONE_MAX_LENGTH,
    SUBJECT_MAX_LENGTH,
    ContactTargetType,
    ConversationStatus,
    ConversationType,
)


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


class Message(UUIDTimeStampedModel):
    """Spec 11.8. Effectively append-only: only `read_at` changes after INSERT,
    which is why this inherits UUIDTimeStampedModel (an `updated_at` that moves
    when a message is marked read is meaningful) rather than the UUIDModel +
    explicit created_at shape ListingSnapshot uses for a truly frozen row.
    """

    conversation = models.ForeignKey(
        Conversation, related_name="messages", on_delete=models.CASCADE
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sent_messages",
        on_delete=models.PROTECT,
    )
    body = models.TextField(max_length=MESSAGE_MAX_LENGTH)
    sender_email_snapshot = models.EmailField(max_length=254)
    # Beyond spec 11.8's list - see the note in this task. Both exist for the
    # same reason sender_email_snapshot does: they record what the sender stated
    # at send time, not a live join to a profile that may since have changed.
    #
    # blank/default="": an INQUIRY always carries a name (spec 15.1 makes it
    # required, 2-120 characters), but a REPLY has no name field, so it stores
    # whatever the account's own `full_name` holds - which may be empty, and
    # must NEVER fall back to the email address. See services._reply_display_name.
    sender_name_snapshot = models.CharField(
        max_length=FULL_NAME_MAX_LENGTH, blank=True, default=""
    )
    sender_phone_snapshot = models.CharField(
        max_length=PHONE_MAX_LENGTH, blank=True, default=""
    )
    is_system = models.BooleanField(default=False)
    # Spec 33.2: "Obtain required consent/version on inquiry." A versioned
    # consent whose version is not retrievable per message is not a record.
    privacy_policy_version = models.CharField(max_length=16, blank=True, default="")
    marketing_consent = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
            models.Index(fields=["conversation", "read_at"]),
        ]

    def __str__(self):
        # Identifiers only. Spec 33.5 keeps message bodies and sender contact
        # snapshots out of logs and operational tooling, and __str__/repr reach
        # both - so neither the body nor any snapshot may appear here.
        return f"message {self.pk} in {self.conversation_id}"


class ContactAccessGrant(UUIDTimeStampedModel):
    """Spec 11.8: "unique active grant per viewer and target".

    Written by this phase (spec 15.3 step 4). Read, masked, revoked and served
    by Phase 7 (spec 16). No method here returns a contact value; the grant is
    an authorization record, not a contact record.
    """

    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="contact_access_grants",
        on_delete=models.CASCADE,
    )
    target_type = models.CharField(max_length=12, choices=ContactTargetType.choices)
    broker = models.ForeignKey(
        "brokers.BrokerOrganization",
        related_name="contact_access_grants",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    professional = models.ForeignKey(
        "professionals.ProfessionalProfile",
        related_name="contact_access_grants",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    source_conversation = models.ForeignKey(
        Conversation, related_name="contact_access_grants", on_delete=models.PROTECT
    )
    # Named by spec 11.8 in its own right. It equals created_at at INSERT, and
    # is the field Phase 7's "granted_at" response key reads - keeping the API's
    # semantic field separate from the row's bookkeeping timestamp.
    granted_at = models.DateTimeField(default=timezone.now)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-granted_at",)
        indexes = [
            models.Index(fields=["viewer", "target_type"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        target_type=ContactTargetType.BROKER,
                        broker__isnull=False,
                        professional__isnull=True,
                    )
                    | models.Q(
                        target_type=ContactTargetType.PROFESSIONAL,
                        professional__isnull=False,
                        broker__isnull=True,
                    )
                ),
                name="messaging_grant_exactly_one_target",
            ),
            # Two partial indexes rather than one over (viewer, target_type,
            # broker, professional): PostgreSQL treats NULLs as distinct, so a
            # composite index covering both target columns would never fire on
            # rows where one of them is NULL - which is every row. The
            # `*__isnull=False` clause in each condition is documentation only,
            # for the same reason.
            models.UniqueConstraint(
                fields=["viewer", "broker"],
                condition=models.Q(revoked_at__isnull=True, broker__isnull=False),
                name="messaging_active_broker_grant_unique",
            ),
            models.UniqueConstraint(
                fields=["viewer", "professional"],
                condition=models.Q(revoked_at__isnull=True, professional__isnull=False),
                name="messaging_active_professional_grant_unique",
            ),
        ]

    def __str__(self):
        # The viewer's id, never their email: spec 33.5 keeps personal contact
        # data out of logs and admin listings.
        return f"{self.target_type} grant to {self.viewer_id}"

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None

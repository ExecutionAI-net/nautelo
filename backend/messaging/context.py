"""Server-side resolution of an inquiry's recipient (spec 11.8, 15.1, 33.1).

The client says what it is looking at (`context_type` + `context_id`); this
module decides who receives the message. A recipient id is never accepted from
a request body anywhere in this app.
"""

import uuid
from dataclasses import dataclass

from brokers.enums import BrokerOrganizationStatus
from brokers.models import BrokerMembership, BrokerOrganization
from listings.views import published_listings_queryset
from messaging.enums import (
    CONTEXT_TO_CONVERSATION_TYPE,
    ContactTargetType,
    InquiryContextType,
)
from messaging.exceptions import (
    InvalidInquiryContext,
    RecipientUnavailable,
    SelfInquiryNotAllowed,
)
from messaging.selectors import broker_message_readers
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile


@dataclass(frozen=True)
class InquiryContext:
    """Everything the submission transaction needs, all of it server-derived."""

    context_type: str
    conversation_type: str
    listing: object | None
    broker: object | None
    professional: object | None
    #: BROKER, PROFESSIONAL, or None when there is nothing to grant (a private
    #: seller - spec 11.8's target_type has no member for a private person).
    contact_target_type: str | None
    #: Who receives the in-app notification (spec 15.4).
    recipient_users: tuple
    #: The single configured address the email goes to (spec 15.4: "not every
    #: member by default"). Empty string means "no address" and is never sent to.
    recipient_email: str
    #: Human label for the notification payload and the email subject line.
    context_label: str


def resolve_inquiry_context(*, actor, context_type, context_id) -> InquiryContext:
    if context_type not in CONTEXT_TO_CONVERSATION_TYPE:
        raise InvalidInquiryContext()
    try:
        target_id = uuid.UUID(str(context_id))
    except (AttributeError, TypeError, ValueError):
        raise InvalidInquiryContext() from None

    if context_type == InquiryContextType.LISTING:
        return _resolve_listing(actor, target_id)
    if context_type == InquiryContextType.BROKER:
        return _resolve_broker(actor, target_id)
    return _resolve_professional(actor, target_id)


def _is_broker_insider(actor, broker) -> bool:
    """ANY active membership, regardless of capability flags.

    A VIEWER has no capability at all, but letting them "inquire" to their own
    organization would mint a ContactAccessGrant over it and manufacture a
    conversation and a notification out of nothing.
    """
    return BrokerMembership.objects.filter(
        user=actor, broker=broker, is_active=True
    ).exists()


def _broker_context(actor, broker, *, listing=None, label=None) -> InquiryContext:
    if broker.status != BrokerOrganizationStatus.ACTIVE:
        raise RecipientUnavailable()
    if _is_broker_insider(actor, broker):
        raise SelfInquiryNotAllowed()
    # `listing is not None`, never a truthiness test: a model instance is always
    # truthy today, but relying on that makes the branch quietly wrong the day
    # anyone gives BoatListing a __bool__ or __len__.
    resolved_type = (
        InquiryContextType.LISTING if listing is not None else InquiryContextType.BROKER
    )
    return InquiryContext(
        context_type=resolved_type,
        conversation_type=CONTEXT_TO_CONVERSATION_TYPE[resolved_type],
        listing=listing,
        broker=broker,
        professional=None,
        contact_target_type=ContactTargetType.BROKER,
        recipient_users=tuple(broker_message_readers(broker)),
        recipient_email=broker.public_email,
        context_label=label or broker.name,
    )


def _resolve_broker(actor, target_id) -> InquiryContext:
    broker = BrokerOrganization.objects.filter(pk=target_id).first()
    if broker is None:
        raise RecipientUnavailable()
    return _broker_context(actor, broker)


def _resolve_professional(actor, target_id) -> InquiryContext:
    professional = (
        ProfessionalProfile.objects.select_related("owner_user")
        .filter(pk=target_id, status=ProfessionalProfileStatus.ACTIVE)
        .first()
    )
    if professional is None:
        raise RecipientUnavailable()
    owner = professional.owner_user
    if owner is None or not owner.is_active:
        raise RecipientUnavailable()
    if owner.pk == actor.pk:
        raise SelfInquiryNotAllowed()
    return InquiryContext(
        context_type=InquiryContextType.PROFESSIONAL,
        conversation_type=CONTEXT_TO_CONVERSATION_TYPE[
            InquiryContextType.PROFESSIONAL
        ],
        listing=None,
        broker=None,
        professional=professional,
        contact_target_type=ContactTargetType.PROFESSIONAL,
        recipient_users=(owner,),
        recipient_email=professional.public_email,
        context_label=professional.display_name,
    )


def _listing_label(listing) -> str:
    """Read from the immutable public snapshot only (Phase 11 contract rule 1).

    An Other-model listing carries its custom text in the snapshot; prefer it,
    because "Azimut Other" is not a boat anybody recognises.
    """
    snapshot = listing.current_public_snapshot
    model_name = (
        snapshot.custom_model_name_snapshot or snapshot.model_name_snapshot
    )
    return f"{snapshot.brand_name_snapshot} {model_name}".strip()


def _resolve_listing(actor, target_id) -> InquiryContext:
    listing = (
        published_listings_queryset()
        .select_related("broker", "owner_user", "current_public_snapshot")
        .filter(pk=target_id)
        .first()
    )
    if listing is None:
        raise RecipientUnavailable()

    label = _listing_label(listing)
    if listing.broker_id is not None:
        return _broker_context(actor, listing.broker, listing=listing, label=label)

    owner = listing.owner_user
    if owner is None or not owner.is_active:
        raise RecipientUnavailable()
    if owner.pk == actor.pk:
        raise SelfInquiryNotAllowed()
    return InquiryContext(
        context_type=InquiryContextType.LISTING,
        conversation_type=CONTEXT_TO_CONVERSATION_TYPE[InquiryContextType.LISTING],
        listing=listing,
        broker=None,
        professional=None,
        # Spec 11.8: a grant targets a BROKER or a PROFESSIONAL. A private
        # seller is neither, so nothing is granted and the API reports
        # NOT_APPLICABLE rather than inventing a third target type.
        contact_target_type=None,
        recipient_users=(owner,),
        recipient_email=owner.email,
        context_label=label,
    )

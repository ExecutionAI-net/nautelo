"""Messaging vocabulary (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md 11.8, 15).

Values are copied verbatim from the spec and must never be renamed: they are
persisted in the database, returned in API responses and written into audit
events.
"""

from django.db import models


class ConversationType(models.TextChoices):
    LISTING_INQUIRY = "LISTING_INQUIRY", "Listing inquiry"
    BROKER_INQUIRY = "BROKER_INQUIRY", "Broker inquiry"
    PROFESSIONAL_INQUIRY = "PROFESSIONAL_INQUIRY", "Professional inquiry"
    SUPPORT = "SUPPORT", "Support"


class ConversationStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    ARCHIVED = "ARCHIVED", "Archived"
    BLOCKED = "BLOCKED", "Blocked"


class ContactTargetType(models.TextChoices):
    """Spec 11.8: a grant targets a broker or a professional, never a person.

    A private seller is deliberately absent. Spec 1 scopes contact reveal to
    "broker/professional contact details"; a private individual's address is not
    business contact data and is never revealed by this mechanism.
    """

    BROKER = "BROKER", "Broker"
    PROFESSIONAL = "PROFESSIONAL", "Professional"


class InquiryContextType(models.TextChoices):
    """The API's own context vocabulary (spec 15.5's `context_type`).

    Deliberately distinct from ConversationType: the client says what it is
    looking at, the server decides what kind of conversation that becomes.
    """

    LISTING = "LISTING", "Listing"
    BROKER = "BROKER", "Broker"
    PROFESSIONAL = "PROFESSIONAL", "Professional"


CONTEXT_TO_CONVERSATION_TYPE: dict[str, str] = {
    InquiryContextType.LISTING: ConversationType.LISTING_INQUIRY,
    InquiryContextType.BROKER: ConversationType.BROKER_INQUIRY,
    InquiryContextType.PROFESSIONAL: ConversationType.PROFESSIONAL_INQUIRY,
}


class ContactAccessOutcome:
    """What POST /api/v1/inquiries/ reports about contact access (spec 15.5).

    GRANTED means an active grant exists for this viewer and target after the
    call, whether this call created it or an earlier one did - the client needs
    to know the state, not the history. NOT_APPLICABLE is the private-seller
    listing case: spec 11.8's target_type has no member for a private person, so
    there is nothing to grant and saying GRANTED would be a lie.
    """

    GRANTED = "GRANTED"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    ALL: frozenset[str] = frozenset({GRANTED, NOT_APPLICABLE})


# Spec 35.1's rollout flag for this phase.
UNIFIED_INQUIRIES_FLAG = "unified_inquiries"

#: Spec 35.1's rollout flag for Phase 7 (contact privacy and reveal). Lives
#: here rather than in contact_access.py so tests/conftest.py can import the
#: string without importing the service and its whole dependency fan-out.
CONTACT_UNLOCK_FLAG = "contact_unlock"

# Spec 15.5's literal. A module constant rather than a platform setting because
# platform_settings.registry.SettingValueType has only BOOLEAN/INTEGER/DECIMAL
# members - there is no string setting type to put it in. See the plan's ruling.
CURRENT_PRIVACY_POLICY_VERSION = "2026-09"

# Spec 15.1's field table, verbatim. PHONE_MAX_LENGTH is not from the table -
# it is the column width brokers.BrokerOrganization.public_phone and
# professionals.ProfessionalProfile.public_phone already use, kept identical so
# a number a provider can store is a number a sender can send.
FULL_NAME_MIN_LENGTH = 2
FULL_NAME_MAX_LENGTH = 120
SUBJECT_MIN_LENGTH = 3
SUBJECT_MAX_LENGTH = 150
MESSAGE_MIN_LENGTH = 20
MESSAGE_MAX_LENGTH = 4000
PHONE_MAX_LENGTH = 32

# Spec 15.1's "abuse detection": the same sender re-posting the same body into
# the same thread inside this window is a double-click, not a second message.
DUPLICATE_MESSAGE_WINDOW_SECONDS = 300

# Spec 15.2's "short-lived signed session" for a guest's draft.
DRAFT_TOKEN_MAX_AGE_SECONDS = 1800
DRAFT_TOKEN_SALT = "messaging.inquiry-draft"

# Spec 15.1's honeypot. Named to look like a field a scraper would fill in.
HONEYPOT_FIELD_NAME = "company_website"

# Spec 15.5's `next_url`. One constant, because spec 4.2 names /messages/ and
# spec 28 names /dashboard/broker/messages/ for the same destination - the phase
# that finally builds the page changes this line and nothing else.
SENDER_CONVERSATION_URL_TEMPLATE = "/dashboard/messages/{conversation_id}/"


def conversation_url(conversation_id) -> str:
    return SENDER_CONVERSATION_URL_TEMPLATE.format(conversation_id=conversation_id)

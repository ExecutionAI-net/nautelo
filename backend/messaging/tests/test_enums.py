"""Spec 11.8 and 15 vocabulary. These values are persisted and returned in API
responses, so the assertions below pin the literal strings, not just the member
names."""

import pytest

from messaging.enums import (
    CONTEXT_TO_CONVERSATION_TYPE,
    CURRENT_PRIVACY_POLICY_VERSION,
    DRAFT_TOKEN_MAX_AGE_SECONDS,
    DRAFT_TOKEN_SALT,
    DUPLICATE_MESSAGE_WINDOW_SECONDS,
    FULL_NAME_MAX_LENGTH,
    FULL_NAME_MIN_LENGTH,
    HONEYPOT_FIELD_NAME,
    MESSAGE_MAX_LENGTH,
    MESSAGE_MIN_LENGTH,
    PHONE_MAX_LENGTH,
    SENDER_CONVERSATION_URL_TEMPLATE,
    SUBJECT_MAX_LENGTH,
    SUBJECT_MIN_LENGTH,
    UNIFIED_INQUIRIES_FLAG,
    ContactAccessOutcome,
    ContactTargetType,
    ConversationStatus,
    ConversationType,
    InquiryContextType,
    conversation_url,
)


def test_conversation_type_values_match_spec_11_8():
    assert [(c.name, c.value) for c in ConversationType] == [
        ("LISTING_INQUIRY", "LISTING_INQUIRY"),
        ("BROKER_INQUIRY", "BROKER_INQUIRY"),
        ("PROFESSIONAL_INQUIRY", "PROFESSIONAL_INQUIRY"),
        ("SUPPORT", "SUPPORT"),
    ]


def test_conversation_status_values_match_spec_11_8():
    assert [(c.name, c.value) for c in ConversationStatus] == [
        ("OPEN", "OPEN"),
        ("ARCHIVED", "ARCHIVED"),
        ("BLOCKED", "BLOCKED"),
        ("CLOSED", "CLOSED"),
    ]


def test_contact_target_type_values_match_spec_11_8():
    assert [(c.name, c.value) for c in ContactTargetType] == [
        ("BROKER", "BROKER"),
        ("PROFESSIONAL", "PROFESSIONAL"),
    ]


def test_request_context_vocabulary_matches_spec_15_5():
    assert [(c.name, c.value) for c in InquiryContextType] == [
        ("LISTING", "LISTING"),
        ("BROKER", "BROKER"),
        ("PROFESSIONAL", "PROFESSIONAL"),
    ]


def test_every_request_context_maps_to_a_conversation_type():
    assert CONTEXT_TO_CONVERSATION_TYPE == {
        "LISTING": ConversationType.LISTING_INQUIRY,
        "BROKER": ConversationType.BROKER_INQUIRY,
        "PROFESSIONAL": ConversationType.PROFESSIONAL_INQUIRY,
    }
    assert set(CONTEXT_TO_CONVERSATION_TYPE) == {c.value for c in InquiryContextType}
    # SUPPORT has no client-facing context: spec 15 has no support-inquiry entry
    # point, and a client able to name it could open threads nothing recognises.
    assert ConversationType.SUPPORT not in CONTEXT_TO_CONVERSATION_TYPE.values()


def test_contact_access_outcomes_are_the_closed_set():
    assert ContactAccessOutcome.ALL == frozenset({"GRANTED", "NOT_APPLICABLE"})
    assert ContactAccessOutcome.GRANTED == "GRANTED"
    assert ContactAccessOutcome.NOT_APPLICABLE == "NOT_APPLICABLE"


def test_spec_15_1_field_limits_are_pinned():
    assert (FULL_NAME_MIN_LENGTH, FULL_NAME_MAX_LENGTH) == (2, 120)
    assert (SUBJECT_MIN_LENGTH, SUBJECT_MAX_LENGTH) == (3, 150)
    assert (MESSAGE_MIN_LENGTH, MESSAGE_MAX_LENGTH) == (20, 4000)
    # Matches the public_phone column width in brokers and professionals.
    assert PHONE_MAX_LENGTH == 32


def test_policy_version_and_flag_and_windows():
    assert CURRENT_PRIVACY_POLICY_VERSION == "2026-09"
    assert UNIFIED_INQUIRIES_FLAG == "unified_inquiries"
    assert DUPLICATE_MESSAGE_WINDOW_SECONDS == 300
    assert DRAFT_TOKEN_MAX_AGE_SECONDS == 1800
    assert DRAFT_TOKEN_SALT == "messaging.inquiry-draft"
    assert HONEYPOT_FIELD_NAME == "company_website"


def test_phone_width_matches_provider_columns():
    from brokers.models import BrokerOrganization
    from professionals.models import ProfessionalProfile

    for model in (BrokerOrganization, ProfessionalProfile):
        assert model._meta.get_field("public_phone").max_length == PHONE_MAX_LENGTH


def test_conversation_url_template_is_pinned():
    assert SENDER_CONVERSATION_URL_TEMPLATE == "/dashboard/private-seller/messages/{conversation_id}/"


@pytest.mark.parametrize("raw", ["b0dd1d0e-0000-4000-8000-000000000001"])
def test_conversation_url_matches_spec_15_5(raw):
    assert conversation_url(raw) == f"/dashboard/private-seller/messages/{raw}/"

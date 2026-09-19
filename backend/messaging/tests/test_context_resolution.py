"""Spec 11.8: "clients may not choose an arbitrary recipient ID"; spec 33.1:
"never trusting recipient/owner IDs from client without context resolution".

Every recipient below is derived from the context object's own ownership.
"""

import uuid

import pytest

from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.tests.factories import make_broker, make_membership
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)
from listings.enums import ListingStatus
from messaging.context import resolve_inquiry_context
from messaging.enums import ContactTargetType, ConversationType, InquiryContextType
from messaging.exceptions import (
    InvalidInquiryContext,
    RecipientUnavailable,
    SelfInquiryNotAllowed,
)
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def asker():
    return make_user(email="ctx-asker@phase6.example")


@pytest.fixture
def staff_approver():
    return make_user(email="ctx-approver@phase6.example")


def _publish(listing, approver):
    """Make a listing publicly visible the way listings.views.published_listings_queryset
    defines it: PUBLISHED status AND a current public snapshot (Phase 11 rule 1)."""
    snapshot = make_snapshot(listing, approved_by=approver)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(
        update_fields=["status", "current_public_snapshot", "updated_at"]
    )
    return listing


def test_unknown_context_type_is_invalid_context(asker):
    with pytest.raises(InvalidInquiryContext):
        resolve_inquiry_context(
            actor=asker, context_type="SUPPORT", context_id=uuid.uuid4()
        )


def test_a_non_uuid_context_id_is_invalid_context(asker):
    with pytest.raises(InvalidInquiryContext):
        resolve_inquiry_context(
            actor=asker,
            context_type=InquiryContextType.BROKER,
            context_id="not-a-uuid",
        )


def test_a_uuid_that_matches_nothing_is_recipient_unavailable_not_404(asker):
    """Spec 34.3: "Pending listing is absent publicly." Distinguishing "exists
    but hidden" from "does not exist" would be an enumeration oracle over
    private listings, so both answer the same way."""
    with pytest.raises(RecipientUnavailable):
        resolve_inquiry_context(
            actor=asker,
            context_type=InquiryContextType.LISTING,
            context_id=uuid.uuid4(),
        )


def test_professional_context_resolves_its_owner_and_public_email(asker):
    owner = make_user(email="ctx-pro-owner@phase6.example")
    professional = make_professional(
        owner,
        display_name="Phase6 Ctx Surveyors",
        slug="phase6-ctx-surveyors",
        public_email="hello@phase6-ctx.example",
    )

    context = resolve_inquiry_context(
        actor=asker,
        context_type=InquiryContextType.PROFESSIONAL,
        context_id=professional.pk,
    )

    assert context.conversation_type == ConversationType.PROFESSIONAL_INQUIRY
    assert context.professional == professional
    assert context.broker is None and context.listing is None
    assert context.contact_target_type == ContactTargetType.PROFESSIONAL
    assert [user.pk for user in context.recipient_users] == [owner.pk]
    assert context.recipient_email == "hello@phase6-ctx.example"
    assert context.context_label == "Phase6 Ctx Surveyors"


@pytest.mark.parametrize(
    "status",
    [
        ProfessionalProfileStatus.DRAFT,
        ProfessionalProfileStatus.PENDING,
        ProfessionalProfileStatus.SUSPENDED,
    ],
)
def test_a_non_active_professional_cannot_receive_an_inquiry(asker, status):
    owner = make_user(email=f"ctx-pro-{status.lower()}@phase6.example")
    professional = make_professional(
        owner,
        display_name=f"Phase6 {status}",
        slug=f"phase6-pro-{status.lower()}",
        status=status,
    )
    with pytest.raises(RecipientUnavailable):
        resolve_inquiry_context(
            actor=asker,
            context_type=InquiryContextType.PROFESSIONAL,
            context_id=professional.pk,
        )


def test_a_professional_cannot_inquire_to_their_own_profile():
    owner = make_user(email="ctx-self-pro@phase6.example")
    professional = make_professional(
        owner, display_name="Phase6 Self", slug="phase6-self-pro"
    )
    with pytest.raises(SelfInquiryNotAllowed):
        resolve_inquiry_context(
            actor=owner,
            context_type=InquiryContextType.PROFESSIONAL,
            context_id=professional.pk,
        )


def test_broker_context_notifies_only_members_with_can_read_messages(asker):
    broker = make_broker(name="Phase6 Ctx Brokers", slug="phase6-ctx-brokers")
    reader = make_user(email="ctx-reader@phase6.example")
    editor = make_user(email="ctx-editor@phase6.example")
    inactive_reader = make_user(email="ctx-inactive@phase6.example")
    make_membership(
        reader, broker, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    # An AGENT with can_edit_listings but not can_read_messages: Phase 3 contract
    # rule 4's exact warning - editing power must not leak message access.
    make_membership(
        editor, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )
    make_membership(
        inactive_reader,
        broker,
        role=BrokerMembershipRole.MANAGER,
        can_read_messages=True,
        is_active=False,
    )

    context = resolve_inquiry_context(
        actor=asker,
        context_type=InquiryContextType.BROKER,
        context_id=broker.pk,
    )

    assert [user.pk for user in context.recipient_users] == [reader.pk]
    assert context.recipient_email == broker.public_email
    assert context.contact_target_type == ContactTargetType.BROKER
    assert context.context_label == "Phase6 Ctx Brokers"


def test_a_suspended_broker_cannot_receive_an_inquiry(asker):
    broker = make_broker(
        name="Phase6 Suspended",
        slug="phase6-suspended",
        status=BrokerOrganizationStatus.SUSPENDED,
    )
    with pytest.raises(RecipientUnavailable):
        resolve_inquiry_context(
            actor=asker, context_type=InquiryContextType.BROKER, context_id=broker.pk
        )


def test_any_active_member_is_an_insider_and_cannot_inquire_to_their_own_broker():
    """Deliberately ANY active membership, not just one with a capability flag: a
    VIEWER minting a contact grant over their own organization is exactly the
    self-grant this rule exists to stop."""
    broker = make_broker(name="Phase6 Insider", slug="phase6-insider")
    viewer = make_user(email="ctx-viewer@phase6.example")
    make_membership(viewer, broker, role=BrokerMembershipRole.VIEWER)
    with pytest.raises(SelfInquiryNotAllowed):
        resolve_inquiry_context(
            actor=viewer, context_type=InquiryContextType.BROKER, context_id=broker.pk
        )


def test_broker_listing_context_carries_both_listing_and_broker(asker, staff_approver):
    broker = make_broker(name="Phase6 Fleet", slug="phase6-fleet")
    reader = make_user(email="ctx-fleet-reader@phase6.example")
    make_membership(
        reader, broker, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    listing = _publish(
        make_broker_listing(broker=broker, actor=reader), staff_approver
    )

    context = resolve_inquiry_context(
        actor=asker, context_type=InquiryContextType.LISTING, context_id=listing.pk
    )

    assert context.conversation_type == ConversationType.LISTING_INQUIRY
    assert context.listing == listing
    assert context.broker == broker
    assert context.professional is None
    assert context.contact_target_type == ContactTargetType.BROKER
    assert [user.pk for user in context.recipient_users] == [reader.pk]
    assert context.recipient_email == broker.public_email
    # The label comes from the immutable public snapshot, never from the draft
    # columns (Phase 11 contract rule 1).
    assert context.context_label == (
        f"{listing.current_public_snapshot.brand_name_snapshot} "
        f"{listing.current_public_snapshot.model_name_snapshot}"
    )


def test_private_listing_context_has_no_contact_target(asker, staff_approver):
    """Spec 11.8's target_type is BROKER|PROFESSIONAL. A private individual's
    address is not business contact data, so there is nothing to grant."""
    seller = make_user(email="ctx-seller@phase6.example")
    listing = _publish(make_private_listing(owner=seller), staff_approver)

    context = resolve_inquiry_context(
        actor=asker, context_type=InquiryContextType.LISTING, context_id=listing.pk
    )

    assert context.broker is None
    assert context.contact_target_type is None
    assert [user.pk for user in context.recipient_users] == [seller.pk]
    assert context.recipient_email == seller.email


def test_an_unpublished_listing_cannot_receive_an_inquiry(asker):
    seller = make_user(email="ctx-draft-seller@phase6.example")
    listing = make_private_listing(owner=seller)
    with pytest.raises(RecipientUnavailable):
        resolve_inquiry_context(
            actor=asker, context_type=InquiryContextType.LISTING, context_id=listing.pk
        )


def test_the_seller_cannot_inquire_about_their_own_published_listing(staff_approver):
    seller = make_user(email="ctx-self-seller@phase6.example")
    listing = _publish(make_private_listing(owner=seller), staff_approver)
    with pytest.raises(SelfInquiryNotAllowed):
        resolve_inquiry_context(
            actor=seller,
            context_type=InquiryContextType.LISTING,
            context_id=listing.pk,
        )


def test_a_broker_with_no_message_readers_resolves_to_an_empty_recipient_list(asker):
    """Not an error: the conversation is still real and appears in the inbox the
    moment staff grants someone can_read_messages. What it does mean is that
    nobody is notified right now - see the plan's Known Limitations."""
    broker = make_broker(name="Phase6 Silent", slug="phase6-silent")
    context = resolve_inquiry_context(
        actor=asker, context_type=InquiryContextType.BROKER, context_id=broker.pk
    )
    assert context.recipient_users == ()
    assert context.recipient_email == broker.public_email

"""Spec 11.8: "Exactly one valid context combination is permitted."

Every assertion below is against a real PostgreSQL constraint, not a Python
guard - spec 2.3 requires database constraints for state that must not drift.
"""

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from listings.tests.factories import make_broker_listing
from messaging.enums import ConversationStatus, ConversationType
from messaging.models import Conversation
from messaging.tests.factories import make_conversation
from platform_settings.models import FeatureFlag
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


def test_broker_inquiry_requires_a_broker_and_no_other_context():
    broker = make_broker(name="Phase6 Brokers", slug="phase6-brokers")
    conversation = make_conversation(
        initiator=make_user(email="asker@phase6.example"),
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    assert conversation.broker_id == broker.pk
    assert conversation.professional_id is None
    assert conversation.listing_id is None
    assert conversation.status == ConversationStatus.OPEN


def test_broker_inquiry_without_a_broker_is_refused_by_the_database():
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_conversation(
                initiator=make_user(email="asker2@phase6.example"),
                conversation_type=ConversationType.BROKER_INQUIRY,
            )


def test_professional_inquiry_cannot_also_carry_a_broker():
    owner = make_user(email="pro-owner@phase6.example")
    professional = make_professional(
        owner, display_name="Phase6 Surveyors", slug="phase6-surveyors"
    )
    broker = make_broker(name="Phase6 Brokers II", slug="phase6-brokers-ii")
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_conversation(
                initiator=make_user(email="asker3@phase6.example"),
                conversation_type=ConversationType.PROFESSIONAL_INQUIRY,
                professional=professional,
                broker=broker,
            )


def test_support_conversation_carries_no_context_at_all():
    conversation = make_conversation(
        initiator=make_user(email="asker4@phase6.example"),
        conversation_type=ConversationType.SUPPORT,
    )
    assert (
        conversation.broker_id,
        conversation.professional_id,
        conversation.listing_id,
    ) == (None, None, None)


def test_only_one_open_broker_conversation_per_initiator_and_broker():
    initiator = make_user(email="asker5@phase6.example")
    broker = make_broker(name="Phase6 Brokers III", slug="phase6-brokers-iii")
    make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_conversation(
                initiator=initiator,
                conversation_type=ConversationType.BROKER_INQUIRY,
                broker=broker,
            )


def test_an_archived_conversation_does_not_block_a_new_open_one():
    """Spec 11.8's uniqueness is over OPEN threads: archiving must let the same
    pair start again, otherwise archiving would permanently mute a relationship."""
    initiator = make_user(email="asker6@phase6.example")
    broker = make_broker(name="Phase6 Brokers IV", slug="phase6-brokers-iv")
    first = make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    first.status = ConversationStatus.ARCHIVED
    first.save(update_fields=["status", "updated_at"])

    second = make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    assert second.pk != first.pk
    assert Conversation.objects.filter(initiator=initiator, broker=broker).count() == 2


def test_a_broker_listing_thread_does_not_collide_with_the_broker_profile_thread():
    """A broker-owned LISTING_INQUIRY sets BOTH listing and broker (spec 11.8:
    the recipient is derived from listing ownership). The broker-profile
    uniqueness constraint must therefore exclude rows that carry a listing, or a
    user could never ask about a boat after asking about the brokerage itself."""
    initiator = make_user(email="asker7@phase6.example")
    broker = make_broker(name="Phase6 Brokers V", slug="phase6-brokers-v")
    make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    listing = make_broker_listing(broker=broker, actor=initiator)
    listing_thread = make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.LISTING_INQUIRY,
        broker=broker,
        listing=listing,
    )
    assert listing_thread.broker_id == broker.pk
    assert Conversation.objects.filter(initiator=initiator, broker=broker).count() == 2


def test_two_open_threads_about_the_same_listing_are_refused():
    initiator = make_user(email="asker9@phase6.example")
    broker = make_broker(name="Phase6 Brokers VI", slug="phase6-brokers-vi")
    listing = make_broker_listing(broker=broker, actor=initiator)
    make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.LISTING_INQUIRY,
        broker=broker,
        listing=listing,
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_conversation(
                initiator=initiator,
                conversation_type=ConversationType.LISTING_INQUIRY,
                broker=broker,
                listing=listing,
            )


def test_last_message_at_defaults_to_null_and_is_writable():
    conversation = make_conversation(
        initiator=make_user(email="asker8@phase6.example"),
        conversation_type=ConversationType.SUPPORT,
    )
    assert conversation.last_message_at is None
    stamp = timezone.now()
    conversation.last_message_at = stamp
    conversation.save(update_fields=["last_message_at", "updated_at"])
    conversation.refresh_from_db()
    assert conversation.last_message_at == stamp


def test_the_rollout_flag_is_seeded_enabled():
    flag = FeatureFlag.objects.get(key="unified_inquiries")
    assert flag.is_enabled is True
    assert flag.description != ""
    assert len(flag.description) <= 255


# --- Database-level boundary tests -------------------------------------------
# Each context rule is exercised on both sides: the combination the constraint
# allows is accepted, the nearest combination it forbids raises IntegrityError.

LISTING = ConversationType.LISTING_INQUIRY
BROKER_INQ = ConversationType.BROKER_INQUIRY
PRO_INQ = ConversationType.PROFESSIONAL_INQUIRY
SUPPORT = ConversationType.SUPPORT


@pytest.fixture
def ctx():
    """One broker, professional and (broker-owned) listing to combine freely."""
    owner = make_user(email="ctx-owner@phase6.example")
    broker = make_broker(name="Phase6 Ctx Brokers", slug="phase6-ctx-brokers")
    return {
        "initiator": make_user(email="ctx-asker@phase6.example"),
        "broker": broker,
        "professional": make_professional(
            owner, display_name="Phase6 Ctx Pro", slug="phase6-ctx-pro"
        ),
        "listing": make_broker_listing(broker=broker, actor=owner),
    }


def _make(ctx, conversation_type, *, broker=False, professional=False, listing=False, **extra):
    return make_conversation(
        initiator=ctx["initiator"],
        conversation_type=conversation_type,
        broker=ctx["broker"] if broker else None,
        professional=ctx["professional"] if professional else None,
        listing=ctx["listing"] if listing else None,
        **extra,
    )


@pytest.mark.parametrize(
    ("conversation_type", "flags"),
    [
        (LISTING, {"listing": True}),
        (LISTING, {"listing": True, "broker": True}),
        (BROKER_INQ, {"broker": True}),
        (PRO_INQ, {"professional": True}),
        (SUPPORT, {}),
    ],
)
def test_allowed_context_combinations_are_accepted(ctx, conversation_type, flags):
    assert _make(ctx, conversation_type, **flags).pk is not None


@pytest.mark.parametrize(
    ("conversation_type", "flags"),
    [
        # LISTING_INQUIRY: needs a listing, never a professional.
        (LISTING, {}),
        (LISTING, {"broker": True}),
        (LISTING, {"professional": True}),
        (LISTING, {"listing": True, "professional": True}),
        (LISTING, {"listing": True, "broker": True, "professional": True}),
        # BROKER_INQUIRY: broker only.
        (BROKER_INQ, {}),
        (BROKER_INQ, {"broker": True, "listing": True}),
        (BROKER_INQ, {"broker": True, "professional": True}),
        (BROKER_INQ, {"listing": True}),
        (BROKER_INQ, {"professional": True}),
        # PROFESSIONAL_INQUIRY: professional only.
        (PRO_INQ, {}),
        (PRO_INQ, {"professional": True, "listing": True}),
        (PRO_INQ, {"professional": True, "broker": True}),
        (PRO_INQ, {"broker": True}),
        (PRO_INQ, {"listing": True}),
        # SUPPORT: no context at all.
        (SUPPORT, {"broker": True}),
        (SUPPORT, {"professional": True}),
        (SUPPORT, {"listing": True}),
    ],
)
def test_forbidden_context_combinations_are_refused_by_the_database(
    ctx, conversation_type, flags
):
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _make(ctx, conversation_type, **flags)


def test_an_unknown_conversation_type_is_refused_by_the_database(ctx):
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _make(ctx, "NOT_A_TYPE", broker=True)


@pytest.mark.parametrize("closed", [ConversationStatus.ARCHIVED, ConversationStatus.BLOCKED])
@pytest.mark.parametrize(
    ("conversation_type", "flags"),
    [
        (LISTING, {"listing": True}),
        (LISTING, {"listing": True, "broker": True}),
        (BROKER_INQ, {"broker": True}),
        (PRO_INQ, {"professional": True}),
    ],
)
def test_open_uniqueness_ignores_non_open_threads_and_covers_open_ones(
    ctx, conversation_type, flags, closed
):
    _make(ctx, conversation_type, status=closed, **flags)
    # a closed twin never blocks an open one ...
    _make(ctx, conversation_type, **flags)
    # ... but a second OPEN one is refused.
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _make(ctx, conversation_type, **flags)


@pytest.mark.parametrize(
    ("conversation_type", "flags"),
    [
        (LISTING, {"listing": True}),
        (BROKER_INQ, {"broker": True}),
        (PRO_INQ, {"professional": True}),
    ],
)
def test_open_uniqueness_is_per_initiator(ctx, conversation_type, flags):
    _make(ctx, conversation_type, **flags)
    other = make_user(email="ctx-other@phase6.example")
    twin = make_conversation(
        initiator=other,
        conversation_type=conversation_type,
        broker=ctx["broker"] if flags.get("broker") else None,
        professional=ctx["professional"] if flags.get("professional") else None,
        listing=ctx["listing"] if flags.get("listing") else None,
    )
    assert twin.pk is not None


def test_open_uniqueness_is_per_context_target(ctx):
    _make(ctx, BROKER_INQ, broker=True)
    other_broker = make_broker(name="Phase6 Ctx Other", slug="phase6-ctx-other")
    assert (
        make_conversation(
            initiator=ctx["initiator"],
            conversation_type=BROKER_INQ,
            broker=other_broker,
        ).pk
        is not None
    )


def test_support_conversations_are_not_unique(ctx):
    _make(ctx, SUPPORT)
    assert _make(ctx, SUPPORT).pk is not None


def test_a_listing_thread_with_a_null_broker_still_conflicts_on_the_listing(ctx):
    _make(ctx, LISTING, listing=True)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _make(ctx, LISTING, listing=True, broker=True)


def test_reverse_accessors_exist(ctx):
    conversation = _make(ctx, LISTING, listing=True, broker=True)
    assert list(ctx["initiator"].initiated_conversations.all()) == [conversation]
    assert list(ctx["broker"].conversations.all()) == [conversation]
    assert list(ctx["listing"].conversations.all()) == [conversation]
    assert ctx["professional"].conversations.count() == 0

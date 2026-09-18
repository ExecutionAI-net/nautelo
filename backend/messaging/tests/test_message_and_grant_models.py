"""Spec 11.8's Message and ContactAccessGrant, and the "unique active grant per
viewer and target" rule the spec states in prose and this module enforces in
PostgreSQL (spec 2.3)."""

from datetime import timedelta

import pytest
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import DataError, IntegrityError, transaction
from django.db.models import ProtectedError
from django.utils import timezone

from accounts.tests.factories import make_user
from brokers.models import BrokerOrganization
from brokers.tests.factories import make_broker
from messaging.enums import (
    FULL_NAME_MAX_LENGTH,
    MESSAGE_MAX_LENGTH,
    PHONE_MAX_LENGTH,
    ContactTargetType,
    ConversationType,
)
from messaging.models import ContactAccessGrant, Conversation, Message
from messaging.tests.factories import make_conversation, make_grant, make_message
from professionals.models import ProfessionalProfile
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def broker_thread():
    initiator = make_user(email="thread-asker@phase6.example")
    broker = make_broker(name="Phase6 Msg Brokers", slug="phase6-msg-brokers")
    conversation = make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    return initiator, broker, conversation


def test_message_snapshots_the_sender_identity_at_send_time(broker_thread):
    initiator, _broker, conversation = broker_thread
    message = make_message(
        conversation=conversation,
        sender=initiator,
        body="I would like to arrange a viewing next week please.",
    )
    assert message.sender_email_snapshot == initiator.email
    assert message.sender_name_snapshot == "Ada Rossi"
    assert message.sender_phone_snapshot == ""
    assert message.is_system is False
    assert message.read_at is None
    assert message.privacy_policy_version == "2026-09"
    assert message.marketing_consent is False


def test_the_snapshot_survives_a_later_account_email_change(broker_thread):
    """Spec 11.8 gives Message its own sender_email_snapshot precisely so the
    thread records what was true at send time, not a live join."""
    initiator, _broker, conversation = broker_thread
    message = make_message(conversation=conversation, sender=initiator)
    initiator.email = "renamed@phase6.example"
    initiator.save(update_fields=["email", "updated_at"])

    message.refresh_from_db()
    assert message.sender_email_snapshot == "thread-asker@phase6.example"
    assert message.sender.email == "renamed@phase6.example"


def test_messages_are_ordered_oldest_first(broker_thread):
    initiator, _broker, conversation = broker_thread
    first = make_message(conversation=conversation, sender=initiator, body="A" * 25)
    second = make_message(conversation=conversation, sender=initiator, body="B" * 25)
    assert list(conversation.messages.all()) == [first, second]


def test_read_at_is_writable(broker_thread):
    initiator, _broker, conversation = broker_thread
    message = make_message(conversation=conversation, sender=initiator)
    stamp = timezone.now()
    Message.objects.filter(pk=message.pk).update(read_at=stamp)
    message.refresh_from_db()
    assert message.read_at == stamp


def test_broker_grant_requires_a_broker_and_refuses_a_professional(broker_thread):
    initiator, broker, conversation = broker_thread
    grant = make_grant(
        viewer=initiator,
        target_type=ContactTargetType.BROKER,
        broker=broker,
        source_conversation=conversation,
    )
    assert grant.professional_id is None
    assert grant.revoked_at is None
    assert grant.granted_at is not None

    owner = make_user(email="grant-pro-owner@phase6.example")
    professional = make_professional(
        owner, display_name="Phase6 Grant Pro", slug="phase6-grant-pro"
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_grant(
                viewer=make_user(email="grant-asker2@phase6.example"),
                target_type=ContactTargetType.BROKER,
                broker=broker,
                professional=professional,
                source_conversation=conversation,
            )


def test_only_one_active_grant_per_viewer_and_broker(broker_thread):
    initiator, broker, conversation = broker_thread
    make_grant(
        viewer=initiator,
        target_type=ContactTargetType.BROKER,
        broker=broker,
        source_conversation=conversation,
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_grant(
                viewer=initiator,
                target_type=ContactTargetType.BROKER,
                broker=broker,
                source_conversation=conversation,
            )


def test_a_revoked_grant_does_not_block_a_new_one(broker_thread):
    """Spec 36.6: a recipient blocking a user "may revoke access"; the default is
    to revoke. Revocation must therefore be re-grantable, or a single block would
    permanently bar a relationship the parties later repair."""
    initiator, broker, conversation = broker_thread
    first = make_grant(
        viewer=initiator,
        target_type=ContactTargetType.BROKER,
        broker=broker,
        source_conversation=conversation,
    )
    first.revoked_at = timezone.now()
    first.save(update_fields=["revoked_at", "updated_at"])

    second = make_grant(
        viewer=initiator,
        target_type=ContactTargetType.BROKER,
        broker=broker,
        source_conversation=conversation,
    )
    assert second.pk != first.pk
    assert ContactAccessGrant.objects.filter(viewer=initiator, broker=broker).count() == 2


def test_a_grant_over_broker_a_does_not_cover_broker_b(broker_thread):
    """Spec 16's acceptance test: "Sending to Broker A does not unlock Broker B"."""
    initiator, broker_a, conversation = broker_thread
    broker_b = make_broker(name="Phase6 Other Brokers", slug="phase6-other-brokers")
    make_grant(
        viewer=initiator,
        target_type=ContactTargetType.BROKER,
        broker=broker_a,
        source_conversation=conversation,
    )
    assert (
        ContactAccessGrant.objects.filter(
            viewer=initiator, broker=broker_b, revoked_at__isnull=True
        ).exists()
        is False
    )


def test_grants_are_not_transferable_between_accounts(broker_thread):
    """Spec 36.6: "Contact access is not transferable between accounts"."""
    initiator, broker, conversation = broker_thread
    make_grant(
        viewer=initiator,
        target_type=ContactTargetType.BROKER,
        broker=broker,
        source_conversation=conversation,
    )
    other = make_user(email="someone-else@phase6.example")
    assert (
        ContactAccessGrant.objects.filter(
            viewer=other, broker=broker, revoked_at__isnull=True
        ).exists()
        is False
    )


# --- Message: column widths, and the values that just fit / just overflow -----
# Every "just outside" case below is asserted against PostgreSQL itself, not a
# Python guard: a varchar(N) column raises DataError on N+1 characters. The one
# exception is `body`, whose TextField renders as an unbounded `text` column -
# see test_body_max_length_is_a_validator_not_a_column_bound.

EMAIL_DOMAIN = "@phase6.example"
EMAIL_MAX_LENGTH = 254
PRIVACY_POLICY_VERSION_MAX_LENGTH = 16
TARGET_TYPE_MAX_LENGTH = 12


def _email_of_length(length):
    email = f"{'a' * (length - len(EMAIL_DOMAIN))}{EMAIL_DOMAIN}"
    assert len(email) == length
    return email


def test_snapshot_column_widths_match_the_vocabulary_and_provider_columns():
    """Spec 15.1's limits, and the provider columns a snapshot must be able to
    hold: a phone a broker can publish is a phone a sender can send."""
    assert (
        Message._meta.get_field("sender_name_snapshot").max_length
        == FULL_NAME_MAX_LENGTH
    )
    assert (
        Message._meta.get_field("sender_phone_snapshot").max_length == PHONE_MAX_LENGTH
    )
    assert (
        Message._meta.get_field("sender_email_snapshot").max_length == EMAIL_MAX_LENGTH
    )
    for model in (BrokerOrganization, ProfessionalProfile):
        assert model._meta.get_field("public_phone").max_length == PHONE_MAX_LENGTH
        assert model._meta.get_field("public_email").max_length == EMAIL_MAX_LENGTH


def test_sender_name_snapshot_is_optional_and_defaults_to_empty(broker_thread):
    """The plan's round-2 ruling: a REPLY has no name field, so the column must
    accept "" rather than be forced to invent one (never the email address)."""
    field = Message._meta.get_field("sender_name_snapshot")
    assert (field.blank, field.default) == (True, "")

    initiator, _broker, conversation = broker_thread
    message = Message.objects.create(
        conversation=conversation,
        sender=initiator,
        body="A reply carries no name field at all, so nothing is snapshotted.",
        sender_email_snapshot=initiator.email,
    )
    message.refresh_from_db()
    assert message.sender_name_snapshot == ""
    assert message.sender_phone_snapshot == ""
    assert message.privacy_policy_version == ""


def test_a_full_length_name_snapshot_is_stored(broker_thread):
    initiator, _broker, conversation = broker_thread
    name = "N" * FULL_NAME_MAX_LENGTH
    message = make_message(
        conversation=conversation, sender=initiator, sender_name_snapshot=name
    )
    message.refresh_from_db()
    assert message.sender_name_snapshot == name
    assert len(message.sender_name_snapshot) == 120


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("sender_name_snapshot", "N" * FULL_NAME_MAX_LENGTH),
        ("sender_phone_snapshot", "9" * PHONE_MAX_LENGTH),
        ("sender_email_snapshot", _email_of_length(EMAIL_MAX_LENGTH)),
        ("privacy_policy_version", "v" * PRIVACY_POLICY_VERSION_MAX_LENGTH),
    ],
)
def test_exactly_the_column_width_is_accepted(broker_thread, field, value):
    initiator, _broker, conversation = broker_thread
    message = make_message(conversation=conversation, sender=initiator, **{field: value})
    message.refresh_from_db()
    assert getattr(message, field) == value


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("sender_name_snapshot", "N" * (FULL_NAME_MAX_LENGTH + 1)),
        ("sender_phone_snapshot", "9" * (PHONE_MAX_LENGTH + 1)),
        ("sender_email_snapshot", _email_of_length(EMAIL_MAX_LENGTH + 1)),
        ("privacy_policy_version", "v" * (PRIVACY_POLICY_VERSION_MAX_LENGTH + 1)),
    ],
)
def test_one_character_over_a_snapshot_column_is_refused_by_the_database(
    broker_thread, field, value
):
    initiator, _broker, conversation = broker_thread
    with pytest.raises((IntegrityError, DataError)):
        with transaction.atomic():
            make_message(conversation=conversation, sender=initiator, **{field: value})


def test_body_max_length_binds_the_form_layer_only_not_the_column(broker_thread):
    """Spec 15.1 caps the message at 4000 characters and this field carries that
    number - but Django's TextField turns `max_length` into a FORM bound only. It
    adds no MaxLengthValidator, so `full_clean()` lets an oversized body through,
    and it renders as an unbounded PostgreSQL `text` column, so the database does
    too. Spec 15.1's cap therefore has to be enforced by Task 6's inquiry
    serializer/service before INSERT. Pinned here, both sides, so that nobody
    later reads the model and assumes the row is already guarded.
    """
    initiator, _broker, conversation = broker_thread
    field = Message._meta.get_field("body")
    assert field.max_length == MESSAGE_MAX_LENGTH

    at_limit = Message(
        conversation=conversation,
        sender=initiator,
        body="B" * MESSAGE_MAX_LENGTH,
        sender_email_snapshot=initiator.email,
    )
    at_limit.full_clean()
    at_limit.save()
    at_limit.refresh_from_db()
    assert len(at_limit.body) == MESSAGE_MAX_LENGTH

    # The form/serializer layer - the only layer that does enforce it - refuses
    # exactly one character more.
    form_field = field.formfield()
    assert form_field.max_length == MESSAGE_MAX_LENGTH
    assert form_field.clean("B" * MESSAGE_MAX_LENGTH)
    with pytest.raises(ValidationError):
        form_field.clean("B" * (MESSAGE_MAX_LENGTH + 1))

    # ... while the model and the column do not. Asserted rather than assumed.
    over_limit = make_message(
        conversation=conversation,
        sender=initiator,
        body="B" * (MESSAGE_MAX_LENGTH + 1),
    )
    over_limit.full_clean()
    over_limit.refresh_from_db()
    assert len(over_limit.body) == MESSAGE_MAX_LENGTH + 1


def test_message_is_indexed_for_the_two_reads_this_phase_makes():
    index_fields = [tuple(index.fields) for index in Message._meta.indexes]
    assert index_fields == [("conversation", "created_at"), ("conversation", "read_at")]
    assert Message._meta.ordering == ("created_at",)


def test_deleting_a_conversation_takes_its_messages_with_it(broker_thread):
    initiator, _broker, conversation = broker_thread
    make_message(conversation=conversation, sender=initiator)
    conversation.delete()
    assert Message.objects.count() == 0


def test_a_sender_cannot_be_deleted_out_from_under_a_message(broker_thread):
    """PROTECT on `sender`: a thread whose messages point at a vanished account
    is not a record of who said what."""
    initiator, _broker, conversation = broker_thread
    make_message(conversation=conversation, sender=initiator)
    with pytest.raises(ProtectedError):
        with transaction.atomic():
            initiator.delete()


def test_message_str_does_not_leak_the_body_or_any_contact_detail(broker_thread):
    """Spec 33.5 keeps message content and sender contact details out of logs and
    operational tooling; `__str__`/`repr` end up in both."""
    initiator, _broker, conversation = broker_thread
    message = make_message(
        conversation=conversation,
        sender=initiator,
        body="Please call me on my mobile about the Bavaria.",
        sender_name_snapshot="Ada Rossi",
        sender_phone_snapshot="+34600111222",
    )
    for rendered in (str(message), repr(message)):
        assert "Ada Rossi" not in rendered
        assert "+34600111222" not in rendered
        assert initiator.email not in rendered
        assert "Bavaria" not in rendered
    assert str(message.pk) in str(message)


def test_messaging_ships_no_message_or_grant_admin():
    """Spec 33.5: message bodies and sender contact snapshots stay out of
    operational tooling, so neither model is registered. Conversation is, which
    is what proves admin autodiscovery ran and this assertion means something."""
    assert Conversation in admin.site._registry
    assert Message not in admin.site._registry
    assert ContactAccessGrant not in admin.site._registry


# --- ContactAccessGrant: the exactly-one-target CHECK -------------------------

BROKER_TARGET = ContactTargetType.BROKER
PROFESSIONAL_TARGET = ContactTargetType.PROFESSIONAL


@pytest.fixture
def grant_ctx():
    """One viewer, two brokers, two professionals, and two source conversations.

    `support_conversation` exists so a target can be deleted without the delete
    tripping over `source_conversation`'s PROTECT: a SUPPORT thread carries no
    broker or professional, so nothing cascades into it.
    """
    viewer = make_user(email="grant-viewer@phase6.example")
    broker = make_broker(name="Phase6 Grant Brokers", slug="phase6-grant-brokers")
    other_broker = make_broker(
        name="Phase6 Grant Brokers II", slug="phase6-grant-brokers-ii"
    )
    professional = make_professional(
        make_user(email="grant-pro1@phase6.example"),
        display_name="Phase6 Grant Pro One",
        slug="phase6-grant-pro-one",
    )
    other_professional = make_professional(
        make_user(email="grant-pro2@phase6.example"),
        display_name="Phase6 Grant Pro Two",
        slug="phase6-grant-pro-two",
    )
    return {
        "viewer": viewer,
        "broker": broker,
        "other_broker": other_broker,
        "professional": professional,
        "other_professional": other_professional,
        "conversation": make_conversation(
            initiator=viewer,
            conversation_type=ConversationType.BROKER_INQUIRY,
            broker=broker,
        ),
        "support_conversation": make_conversation(
            initiator=viewer, conversation_type=ConversationType.SUPPORT
        ),
    }


def _grant(
    ctx,
    target_type,
    *,
    broker=False,
    professional=False,
    viewer=None,
    source="conversation",
    **extra,
):
    return make_grant(
        viewer=ctx["viewer"] if viewer is None else viewer,
        target_type=target_type,
        broker=ctx["broker"] if broker else None,
        professional=ctx["professional"] if professional else None,
        source_conversation=ctx[source],
        **extra,
    )


@pytest.mark.parametrize(
    ("target_type", "flags"),
    [
        (BROKER_TARGET, {"broker": True}),
        (PROFESSIONAL_TARGET, {"professional": True}),
    ],
)
def test_the_two_valid_grant_shapes_are_accepted(grant_ctx, target_type, flags):
    assert _grant(grant_ctx, target_type, **flags).pk is not None


@pytest.mark.parametrize(
    ("target_type", "flags"),
    [
        # BROKER: needs a broker, and never a professional alongside it.
        (BROKER_TARGET, {}),
        (BROKER_TARGET, {"professional": True}),
        (BROKER_TARGET, {"broker": True, "professional": True}),
        # PROFESSIONAL: needs a professional, and never a broker alongside it.
        (PROFESSIONAL_TARGET, {}),
        (PROFESSIONAL_TARGET, {"broker": True}),
        (PROFESSIONAL_TARGET, {"broker": True, "professional": True}),
    ],
)
def test_every_other_target_shape_is_refused_by_the_database(
    grant_ctx, target_type, flags
):
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _grant(grant_ctx, target_type, **flags)


def test_an_unknown_target_type_is_refused_by_the_database(grant_ctx):
    """The CHECK enumerates the two members of spec 11.8's vocabulary, so a third
    value cannot reach the table even though the column is a plain CharField.
    "SELLER" is deliberately short enough to fit varchar(12): the point is that
    the CHECK refuses it, not that the column is too narrow for it."""
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _grant(grant_ctx, "SELLER", broker=True)


def test_target_type_column_holds_the_longest_member_and_no_more(grant_ctx):
    assert (
        ContactAccessGrant._meta.get_field("target_type").max_length
        == TARGET_TYPE_MAX_LENGTH
    )
    assert len(PROFESSIONAL_TARGET.value) == TARGET_TYPE_MAX_LENGTH
    with pytest.raises((IntegrityError, DataError)):
        with transaction.atomic():
            _grant(grant_ctx, "P" * (TARGET_TYPE_MAX_LENGTH + 1), broker=True)


# --- ContactAccessGrant: the two partial unique indexes -----------------------
# Phase 7 reads these. Each is exercised on four axes: the duplicate it forbids,
# the second target it must allow, the second viewer it must allow, and the
# revoke-then-regrant cycle spec 36.6 requires.


@pytest.mark.parametrize(
    ("target_type", "flags"),
    [
        (BROKER_TARGET, {"broker": True}),
        (PROFESSIONAL_TARGET, {"professional": True}),
    ],
)
def test_a_second_active_grant_over_the_same_target_is_refused(
    grant_ctx, target_type, flags
):
    _grant(grant_ctx, target_type, **flags)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _grant(grant_ctx, target_type, **flags)


@pytest.mark.parametrize(
    ("target_type", "field", "other_key"),
    [
        (BROKER_TARGET, "broker", "other_broker"),
        (PROFESSIONAL_TARGET, "professional", "other_professional"),
    ],
)
def test_the_same_viewer_may_hold_active_grants_over_two_different_targets(
    grant_ctx, target_type, field, other_key
):
    """Spec 16: "Sending to Broker A does not unlock Broker B" - and its converse,
    that holding A must never stop B being granted. A uniqueness rule narrowed to
    the viewer alone would fail here while passing every same-target test."""
    make_grant(
        viewer=grant_ctx["viewer"],
        target_type=target_type,
        source_conversation=grant_ctx["conversation"],
        **{field: grant_ctx[field]},
    )
    second = make_grant(
        viewer=grant_ctx["viewer"],
        target_type=target_type,
        source_conversation=grant_ctx["conversation"],
        **{field: grant_ctx[other_key]},
    )
    assert second.pk is not None
    assert (
        ContactAccessGrant.objects.filter(
            viewer=grant_ctx["viewer"], revoked_at__isnull=True
        ).count()
        == 2
    )


def test_one_viewer_may_hold_a_broker_grant_and_a_professional_grant_at_once(grant_ctx):
    """The two indexes are independent: a broker grant must not consume the
    viewer's professional slot."""
    _grant(grant_ctx, BROKER_TARGET, broker=True)
    _grant(grant_ctx, PROFESSIONAL_TARGET, professional=True)
    assert (
        ContactAccessGrant.objects.filter(
            viewer=grant_ctx["viewer"], revoked_at__isnull=True
        ).count()
        == 2
    )


@pytest.mark.parametrize(
    ("target_type", "flags"),
    [
        (BROKER_TARGET, {"broker": True}),
        (PROFESSIONAL_TARGET, {"professional": True}),
    ],
)
def test_uniqueness_is_per_viewer_not_only_per_target(grant_ctx, target_type, flags):
    _grant(grant_ctx, target_type, **flags)
    other_viewer = make_user(email="grant-viewer2@phase6.example")
    assert _grant(grant_ctx, target_type, viewer=other_viewer, **flags).pk is not None


@pytest.mark.parametrize(
    ("target_type", "flags"),
    [
        (BROKER_TARGET, {"broker": True}),
        (PROFESSIONAL_TARGET, {"professional": True}),
    ],
)
def test_revoking_frees_the_slot_and_the_next_duplicate_is_refused_again(
    grant_ctx, target_type, flags
):
    """The full cycle: grant, duplicate refused, revoke, re-grant accepted, and
    the re-granted row is itself unique again."""
    first = _grant(grant_ctx, target_type, **flags)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _grant(grant_ctx, target_type, **flags)

    first.revoked_at = timezone.now()
    first.save(update_fields=["revoked_at", "updated_at"])

    second = _grant(grant_ctx, target_type, **flags)
    assert second.pk != first.pk
    assert second.is_active is True
    first.refresh_from_db()
    assert first.is_active is False

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _grant(grant_ctx, target_type, **flags)


def test_many_revoked_grants_may_coexist(grant_ctx):
    """Only ACTIVE grants are unique; the revoked history is unbounded."""
    for _ in range(3):
        grant = _grant(grant_ctx, BROKER_TARGET, broker=True)
        grant.revoked_at = timezone.now()
        grant.save(update_fields=["revoked_at", "updated_at"])
    assert (
        ContactAccessGrant.objects.filter(
            viewer=grant_ctx["viewer"], broker=grant_ctx["broker"]
        ).count()
        == 3
    )


# --- ContactAccessGrant: shape, defaults, cascades ----------------------------


def test_grant_defaults_and_index(grant_ctx):
    before = timezone.now()
    grant = _grant(grant_ctx, BROKER_TARGET, broker=True)
    grant.refresh_from_db()
    assert before <= grant.granted_at <= timezone.now()
    assert grant.revoked_at is None
    assert grant.is_active is True
    assert ContactAccessGrant._meta.ordering == ("-granted_at",)
    assert [tuple(index.fields) for index in ContactAccessGrant._meta.indexes] == [
        ("viewer", "target_type")
    ]


def test_an_explicit_granted_at_is_honoured(grant_ctx):
    """`default=timezone.now`, never `auto_now_add`. granted_at is a writable
    business timestamp - it is what Phase 7 serves as the API's `granted_at` key,
    and what a re-grant or a backfill has to be able to state - whereas
    `auto_now_add` would silently overwrite any value the caller supplied with
    the INSERT time and make the column non-editable thereafter."""
    field = ContactAccessGrant._meta.get_field("granted_at")
    assert field.auto_now_add is False
    assert field.editable is True

    stamp = timezone.now() - timedelta(days=5)
    grant = _grant(grant_ctx, BROKER_TARGET, broker=True, granted_at=stamp)
    grant.refresh_from_db()
    assert grant.granted_at == stamp
    assert grant.granted_at < grant.created_at


def test_grants_are_listed_newest_granted_first(grant_ctx):
    older = _grant(
        grant_ctx,
        BROKER_TARGET,
        broker=True,
        granted_at=timezone.now() - timedelta(days=2),
    )
    older.revoked_at = timezone.now()
    older.save(update_fields=["revoked_at", "updated_at"])
    newer = _grant(grant_ctx, BROKER_TARGET, broker=True)
    assert list(ContactAccessGrant.objects.all()) == [newer, older]


def test_reverse_accessors_are_the_names_phase_7_reads(grant_ctx):
    broker_grant = _grant(grant_ctx, BROKER_TARGET, broker=True)
    professional_grant = _grant(grant_ctx, PROFESSIONAL_TARGET, professional=True)
    assert set(grant_ctx["viewer"].contact_access_grants.all()) == {
        broker_grant,
        professional_grant,
    }
    assert list(grant_ctx["broker"].contact_access_grants.all()) == [broker_grant]
    assert list(grant_ctx["professional"].contact_access_grants.all()) == [
        professional_grant
    ]
    assert set(grant_ctx["conversation"].contact_access_grants.all()) == {
        broker_grant,
        professional_grant,
    }


def test_the_source_conversation_of_a_grant_cannot_be_deleted(grant_ctx):
    """PROTECT: the grant records WHY contact was unlocked. Deleting the thread
    that justified it would leave an authorization nobody can audit."""
    _grant(grant_ctx, BROKER_TARGET, broker=True)
    with pytest.raises(ProtectedError):
        with transaction.atomic():
            grant_ctx["conversation"].delete()
    assert Conversation.objects.filter(pk=grant_ctx["conversation"].pk).exists()


def test_deleting_the_viewer_removes_their_grants(grant_ctx):
    """CASCADE on `viewer`: a closed account holds no authorizations. The viewer
    here did not open the source thread, so nothing PROTECTed is in the way."""
    outsider = make_user(email="grant-outsider@phase6.example")
    _grant(grant_ctx, BROKER_TARGET, broker=True, viewer=outsider)
    assert ContactAccessGrant.objects.count() == 1
    outsider.delete()
    assert ContactAccessGrant.objects.count() == 0
    assert Conversation.objects.filter(pk=grant_ctx["conversation"].pk).exists()


@pytest.mark.parametrize(
    ("target_type", "flags", "owner_key"),
    [
        (BROKER_TARGET, {"broker": True}, "broker"),
        (PROFESSIONAL_TARGET, {"professional": True}, "professional"),
    ],
)
def test_deleting_the_target_removes_the_grant(grant_ctx, target_type, flags, owner_key):
    """CASCADE on the target: a brokerage or professional that no longer exists
    cannot have an outstanding authorization to its contact details. The grant
    hangs off the SUPPORT thread so the target's own threads are irrelevant."""
    _grant(grant_ctx, target_type, source="support_conversation", **flags)
    grant_ctx["conversation"].delete()
    grant_ctx[owner_key].delete()
    assert ContactAccessGrant.objects.count() == 0


def test_grant_str_names_no_person_and_no_contact_detail(grant_ctx):
    grant = _grant(grant_ctx, BROKER_TARGET, broker=True)
    for rendered in (str(grant), repr(grant)):
        assert grant_ctx["viewer"].email not in rendered
        assert grant_ctx["broker"].public_email not in rendered
        assert grant_ctx["broker"].public_phone not in rendered
    assert BROKER_TARGET.value in str(grant)


def test_grant_constraint_names_are_the_ones_phase_7_expects():
    """Phase 7 turns these IntegrityErrors into responses by constraint name, so
    renaming one silently is a cross-phase break."""
    names = {constraint.name for constraint in ContactAccessGrant._meta.constraints}
    assert names == {
        "messaging_grant_exactly_one_target",
        "messaging_active_broker_grant_unique",
        "messaging_active_professional_grant_unique",
    }

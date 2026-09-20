from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from accounts.models import User, UserManager
from accounts.services import is_staff_admin
from brokers.enums import BrokerMembershipRole
from brokers.models import BrokerMembership
from brokers.selectors import (
    broker_audit_history,
    broker_listing_counts,
    pending_revision_count,
)
from brokers.services import POLICY_REASON_REQUIRED_MESSAGE


class BrokerMembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = BrokerMembership
        fields = (
            "id",
            "user_email",
            "user_full_name",
            "role",
            "can_edit_listings",
            "can_manage_team",
            "can_read_messages",
            "is_owner",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


ELEVATED_FIELDS = ("role", "can_edit_listings", "can_manage_team", "can_read_messages")


def _actor_may_grant_admin(actor, broker) -> bool:
    """Only an existing ADMIN of this broker - or a staff admin - may create ADMINs.

    A MANAGER holding can_manage_team=True is trusted to move AGENTs and VIEWERs
    around; it must NOT be able to mint a peer (or a superior) of the ADMIN who
    granted it that trust.
    """
    if is_staff_admin(actor):
        return True
    return BrokerMembership.objects.filter(
        user=actor,
        broker=broker,
        role=BrokerMembershipRole.ADMIN,
        is_active=True,
    ).exists()


def _grants_admin_authority(role, can_manage_team) -> bool:
    # bool(), not `is True`: a caller passing a truthy non-True value (1, or a
    # DB backend's integer 0/1) must not slip past this check.
    return role == BrokerMembershipRole.ADMIN or bool(can_manage_team)


class BrokerMembershipCreateSerializer(serializers.Serializer):
    user_email = serializers.EmailField(max_length=254)
    role = serializers.ChoiceField(
        choices=BrokerMembershipRole.choices, default=BrokerMembershipRole.VIEWER
    )
    can_edit_listings = serializers.BooleanField(default=False)
    can_manage_team = serializers.BooleanField(default=False)
    can_read_messages = serializers.BooleanField(default=False)

    def validate_user_email(self, value):
        normalized = UserManager.normalize_email(value)
        user = User.objects.filter(email=normalized, is_active=True).first()
        if user is None:
            raise serializers.ValidationError("user_not_found")
        broker = self.context["broker"]
        if BrokerMembership.objects.filter(user=user, broker=broker).exists():
            raise serializers.ValidationError("membership_exists")
        self.context["target_user"] = user
        return normalized

    def validate(self, attrs):
        # Rank check: a non-ADMIN may not create an ADMIN, nor hand out
        # can_manage_team (which is ADMIN-equivalent authority over the team).
        role = attrs.get("role", BrokerMembershipRole.VIEWER)
        manage_team = attrs.get("can_manage_team", False)
        if _grants_admin_authority(role, manage_team) and not _actor_may_grant_admin(
            self.context["actor"], self.context["broker"]
        ):
            # Key the error under the field that actually carries the grant.
            field = "role" if role == BrokerMembershipRole.ADMIN else "can_manage_team"
            raise serializers.ValidationError(
                {field: ["broker_admin_grant_requires_admin"]}
            )
        return attrs

    def create(self, validated_data):
        from brokers.plans import ensure_seat_capacity

        ensure_seat_capacity(self.context["broker"])
        validated_data.pop("user_email")
        return BrokerMembership.objects.create(
            user=self.context["target_user"],
            broker=self.context["broker"],
            **validated_data,
        )


class BrokerMembershipUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrokerMembership
        fields = (
            "role",
            "can_edit_listings",
            "can_manage_team",
            "can_read_messages",
            "is_active",
        )

    def validate(self, attrs):
        membership = self.instance
        actor = self.context["actor"]
        touching_elevated = any(field in attrs for field in ELEVATED_FIELDS)
        editing_own_row = membership.user_id == getattr(actor, "pk", None)

        # The owner (who registered the brokerage) cannot be demoted or removed here.
        if membership.is_owner and (touching_elevated or attrs.get("is_active") is False):
            raise serializers.ValidationError({"role": ["cannot_change_owner"]})

        # (b) NOBODY edits their own role or capability flags through this endpoint,
        #     whatever their rank. Self-service privilege changes are not a thing.
        #     Deactivating your own membership (is_active=False) stays allowed.
        if touching_elevated and editing_own_row:
            raise serializers.ValidationError(
                {"role": ["cannot_change_own_broker_role"]}
            )

        # Leaving the team is exempt from the rank check below. `is_active=False`
        # on your OWN row only ever REDUCES authority, so no escalation path runs
        # through it whatever rank the actor holds. Without this exemption the
        # post-patch rank rule would read the leaver's own can_manage_team=True
        # (a PATCH that omits the flag keeps it) and refuse - and since a member
        # holding can_manage_team is the ONLY kind of non-ADMIN that reaches this
        # endpoint at all, every such member would be permanently locked into the
        # team, reachable only by someone else acting on their row.
        #
        # The exemption is deliberately narrow, and safe on its own terms rather
        # than by check ordering: it requires the actor's OWN row, `is_active`
        # being set to False, and NO elevated field anywhere in the request, so a
        # role change or flag grant cannot ride in on a self-deactivation. The
        # last-admin guard below still applies - that is the one case where
        # leaving is legitimately refused.
        self_deactivation = (
            editing_own_row
            and not touching_elevated
            and attrs.get("is_active") is False
        )

        # (a) Rank check: only an existing ADMIN of this broker (or a staff admin)
        #     may promote anyone to ADMIN or hand out can_manage_team.
        role = attrs.get("role", membership.role)
        manage_team = attrs.get("can_manage_team", membership.can_manage_team)
        if (
            _grants_admin_authority(role, manage_team)
            and not self_deactivation
            and not _actor_may_grant_admin(actor, membership.broker)
        ):
            # Key the error under the field that actually carries the grant.
            field = "role" if role == BrokerMembershipRole.ADMIN else "can_manage_team"
            raise serializers.ValidationError(
                {field: ["broker_admin_grant_requires_admin"]}
            )

        # A role change resets the capability flags to the role's defaults
        # (BrokerMembership.save()), so accepting both in one request would
        # silently discard the flags. Refuse rather than surprise the caller.
        if "role" in attrs and attrs["role"] != membership.role:
            conflicting = [f for f in ELEVATED_FIELDS if f != "role" and f in attrs]
            if conflicting:
                raise serializers.ValidationError(
                    {f: ["set_flags_in_a_separate_request"] for f in conflicting}
                )

        losing_admin = (
            attrs.get("role", membership.role) != BrokerMembershipRole.ADMIN
            or attrs.get("is_active", membership.is_active) is False
        )
        if membership.role == BrokerMembershipRole.ADMIN and membership.is_active and losing_admin:
            # The caller has already taken a row lock on this broker's memberships
            # (BrokerMemberDetailView, inside transaction.atomic), so this count
            # cannot race another concurrent demotion - see the note below.
            remaining = (
                BrokerMembership.objects.filter(
                    broker=membership.broker,
                    role=BrokerMembershipRole.ADMIN,
                    is_active=True,
                )
                .exclude(pk=membership.pk)
                .exists()
            )
            if not remaining:
                field = "role" if attrs.get("role", membership.role) != BrokerMembershipRole.ADMIN else "is_active"
                raise serializers.ValidationError({field: ["last_broker_admin"]})
        return attrs


def actor_ref(user) -> dict | None:
    """The minimum identification of a staff actor: who to ask about a change.

    Deliberately three fields. This payload is read by staff moderators, and a
    full user serialization would put an unrelated person's role, locale and
    verification state on a screen that only needs to name them.
    """
    if user is None:
        return None
    return {
        "id": str(user.pk),
        "email": user.email,
        "full_name": user.full_name,
    }


def audit_entry(event) -> dict:
    """One row of the staff broker audit history.

    `reason` is lifted out of `metadata` to the top level because it is the one
    field spec §21 requires the panel to show; the raw `before`/`after` are kept
    alongside it so a reviewer can see exactly what moved.
    """
    return {
        "id": str(event.pk),
        "action": event.action,
        "actor": actor_ref(event.actor_user),
        "created_at": event.created_at,
        "reason": (event.metadata or {}).get("reason", ""),
        "before": event.before,
        "after": event.after,
    }


class StaffBrokerDetailSerializer(serializers.Serializer):
    """Everything spec §21's "Staff broker UI" enumerates, in one payload.

    Read-only by construction — no `create`, no `update`. The two mutations have
    their own serializers and their own, narrower permission tiers, so nothing
    here can be turned into a write by adding a field.

    Also the response body of the approval-policy PATCH (Task 5), so a staff
    admin toggling the switch gets the refreshed counts, stamps and audit
    history back in the same round trip (spec §30.2: "Mutations return updated
    resource/version").
    """

    def to_representation(self, broker):
        return {
            "id": str(broker.pk),
            "name": broker.name,
            "slug": broker.slug,
            # §21 Staff broker UI item 1 — account status.
            "status": broker.status,
            # §21 Staff broker UI item 3 — the switch, its state, last changed
            # by and last changed at.
            "auto_approve_listings": broker.auto_approve_listings,
            "auto_approve_changed_by": actor_ref(broker.auto_approve_changed_by),
            "auto_approve_changed_at": broker.auto_approve_changed_at,
            # §21 Staff broker UI item 2 — listing counts by status.
            "listing_counts": broker_listing_counts(broker),
            # Drives the §21 rule 7 bulk-approve action (Task 6).
            "pending_revision_count": pending_revision_count(broker),
            # §21 Staff broker UI item 6 — audit history.
            "audit_history": [
                audit_entry(event) for event in broker_audit_history(broker)
            ],
        }


class BrokerApprovalPolicySerializer(serializers.Serializer):
    """Body of PATCH /api/v1/staff/brokers/<id>/approval-policy/ (spec §30.1).

    The reason is validated here *as well as* inside
    `brokers.services.clean_policy_reason`, deliberately: this layer turns a
    missing reason into a 400 with the field named before any row is locked,
    while the service keeps its own check so the rule still holds for every
    non-HTTP caller. The message lives in one constant so the two never drift.

    `required=False, allow_blank=True, default=""` makes a *missing* `reason` and
    a *blank* one produce the same `policy_reason_required` code instead of DRF's
    generic `required` / `blank`.
    """

    auto_approve_listings = serializers.BooleanField()
    reason = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=500
    )

    def validate_reason(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError(
                ErrorDetail(
                    POLICY_REASON_REQUIRED_MESSAGE, code="policy_reason_required"
                )
            )
        return cleaned


class BrokerBulkApproveSerializer(serializers.Serializer):
    """Body of POST /api/v1/staff/brokers/<id>/pending-approvals/ (spec §21 rule 7).

    `confirm` is a server-side control, not a record of a browser dialog: spec
    §39 forbids visual-only implementations, so "with confirmation" has to be
    something the API refuses without. `required=False, default=False` makes an
    omitted flag fail the same way an explicit `false` does.
    """

    confirm = serializers.BooleanField(required=False, default=False)
    reason = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=500
    )

    def validate_confirm(self, value):
        if value is not True:
            raise serializers.ValidationError(
                ErrorDetail(
                    "Confirm that every pending submission for this broker "
                    "should be approved.",
                    code="bulk_approve_not_confirmed",
                )
            )
        return value

    def validate_reason(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError(
                ErrorDetail(
                    "Explain why this broker's pending submissions are being "
                    "approved together.",
                    code="policy_reason_required",
                )
            )
        return cleaned

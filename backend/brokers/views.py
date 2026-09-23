from dataclasses import asdict

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import (
    IsActiveUser,
    IsBrokerTeamManager,
    IsEmailVerified,
    IsStaffAdmin,
    IsStaffModerator,
)
from brokers.dashboard import broker_dashboard_metrics
from brokers.models import BrokerMembership, BrokerOrganization
from brokers.moderation import bulk_approve_pending_broker_revisions
from brokers.permissions import IsBrokerBilling, IsBrokerMember
from brokers.serializers import (
    BrokerApprovalPolicySerializer,
    BrokerBulkApproveSerializer,
    BrokerMembershipCreateSerializer,
    BrokerMembershipSerializer,
    BrokerMembershipUpdateSerializer,
    StaffBrokerDetailSerializer,
)
from brokers.services import set_broker_auto_approval
from listings.permissions import ListingWorkflowEnabled


class BrokerTeamBaseView(APIView):
    throttle_scope = "broker_team"

    permission_classes = [IsActiveUser, IsEmailVerified, IsBrokerTeamManager]

    def get_broker(self):
        return get_object_or_404(BrokerOrganization, pk=self.kwargs["broker_id"])

    def get_locked_broker(self):
        """Lock the broker row, then the membership rows the admin count reads.

        Locking the parent row first gives every team-mutating request on this
        broker a single serialization point, so the last-admin check below is a
        genuine check-then-act rather than two racing reads.
        """
        broker = get_object_or_404(
            BrokerOrganization.objects.select_for_update(), pk=self.kwargs["broker_id"]
        )
        list(
            BrokerMembership.objects.select_for_update()
            .filter(broker=broker)
            .values_list("pk", flat=True)
        )
        return broker

    def get_membership(self, broker):
        return get_object_or_404(
            BrokerMembership, pk=self.kwargs["membership_id"], broker=broker
        )


class BrokerMemberListView(BrokerTeamBaseView):
    def get(self, request, broker_id):
        broker = self.get_broker()
        memberships = BrokerMembership.objects.select_related("user").filter(broker=broker)
        return Response(BrokerMembershipSerializer(memberships, many=True).data)

    @transaction.atomic
    def post(self, request, broker_id):
        broker = self.get_locked_broker()
        serializer = BrokerMembershipCreateSerializer(
            data=request.data, context={"broker": broker, "actor": request.user}
        )
        serializer.is_valid(raise_exception=True)
        membership = serializer.save()
        return Response(
            BrokerMembershipSerializer(membership).data, status=status.HTTP_201_CREATED
        )


class BrokerMemberDetailView(BrokerTeamBaseView):
    @transaction.atomic
    def patch(self, request, broker_id, membership_id):
        membership = self.get_membership(self.get_locked_broker())
        serializer = BrokerMembershipUpdateSerializer(
            membership,
            data=request.data,
            partial=True,
            context={"actor": request.user},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        membership.refresh_from_db()
        return Response(BrokerMembershipSerializer(membership).data)

    @transaction.atomic
    def delete(self, request, broker_id, membership_id):
        membership = self.get_membership(self.get_locked_broker())
        serializer = BrokerMembershipUpdateSerializer(
            membership,
            data={"is_active": False},
            partial=True,
            context={"actor": request.user},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StaffBrokerDetailView(APIView):
    """GET /api/v1/staff/brokers/<id>/ — the source behind spec §21's staff screen.

    IsStaffModerator, not IsStaffAdmin: spec §5 restricts *configuring* the
    policy to staff admin and says nothing about seeing it, and a moderator
    working the boats queue needs this broker's status, backlog and policy state
    to decide anything. The payload carries no contact details, no member list
    and no listing content — only counts, policy state and this organization's
    own audit rows.

    Not gated on the `listing_revisions` flag: refusing to *show* a policy state
    tells staff nothing and would hide the audit history during an incident. The
    two mutations that follow are gated.
    """

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffModerator]

    def get(self, request, broker_id):
        broker = get_object_or_404(
            BrokerOrganization.objects.select_related("auto_approve_changed_by"),
            pk=broker_id,
        )
        return Response(StaffBrokerDetailSerializer().to_representation(broker))


class BrokerApprovalPolicyView(APIView):
    """PATCH /api/v1/staff/brokers/<id>/approval-policy/ (spec §30.1, §21 rule 4).

    The permission stack is the whole security boundary of spec §5's
    "Configure broker auto-approval - staff admin only" row, so it is spelled
    out rather than inherited: authenticated, active, the `listing_revisions`
    flag (spec §35.1), and staff **admin**, strictly narrower than the
    IsStaffModerator gate on the read endpoint beside it.

    Returns the whole staff-broker detail payload plus `changed`, so the screen
    refreshes in one round trip (spec §30.2). A repeat toggle is a 200 with
    `changed: false` and no new audit row.
    """
    throttle_scope = "staff_moderation"

    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        ListingWorkflowEnabled,
        IsStaffAdmin,
    ]

    def patch(self, request, broker_id):
        broker = get_object_or_404(BrokerOrganization, pk=broker_id)
        envelope = BrokerApprovalPolicySerializer(data=request.data)
        envelope.is_valid(raise_exception=True)

        change = set_broker_auto_approval(
            broker,
            enabled=envelope.validated_data["auto_approve_listings"],
            actor=request.user,
            reason=envelope.validated_data["reason"],
        )

        payload = StaffBrokerDetailSerializer().to_representation(change.broker)
        payload["changed"] = change.changed
        return Response(payload)


class BrokerPendingApprovalsView(APIView):
    """POST /api/v1/staff/brokers/<id>/pending-approvals/ (spec §21 rule 7).

    IsStaffModerator, not IsStaffAdmin: spec §5 gives "Approve
    listings/revisions" to both tiers, and this action is approving listings —
    many at once — not configuring a policy. The narrower staff-admin gate
    belongs to BrokerApprovalPolicyView beside it.

    Deliberately not `@transaction.atomic`: the service takes one savepoint per
    revision so a single invalid submission cannot block the rest of the run.
    """
    throttle_scope = "staff_moderation"

    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        ListingWorkflowEnabled,
        IsStaffModerator,
    ]

    def post(self, request, broker_id):
        broker = get_object_or_404(BrokerOrganization, pk=broker_id)
        envelope = BrokerBulkApproveSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)

        result = bulk_approve_pending_broker_revisions(
            broker=broker,
            actor=request.user,
            reason=envelope.validated_data["reason"],
        )

        broker.refresh_from_db()
        return Response(
            {
                "approved_count": len(result.approved),
                "failed_count": len(result.failures),
                "approved_revision_ids": result.approved,
                "failures": [asdict(failure) for failure in result.failures],
                # The refreshed detail travels with the run so the screen's
                # counts, backlog size and audit history update in one round
                # trip (spec §30.2).
                "broker": StaffBrokerDetailSerializer().to_representation(broker),
            }
        )


class BrokerDashboardView(APIView):
    """GET /api/v1/brokers/<id>/dashboard/ — spec 28's "Dashboard metrics".

    An addition beyond spec 30.1's table, flagged here rather than presented as
    spec-literal, exactly as Phase 12 flagged its two staff routes. Spec 28's
    "Broker home may show only backend-derived useful metrics" cannot be true
    without one (spec 2.1), and spec 30.1's closing sentence grants the latitude.

    NOT flag-gated, so `IsAuthenticated` is first and Phase 6 contract rule 11a
    does not apply (it governs messaging views that HAVE a flag gate). The
    listing metrics are Phase 11/12 state and have nothing to do with
    `unified_inquiries`; the messaging block reports enabled=false with null
    counts when the flag is off, so broker home keeps working with its messaging
    tiles hidden rather than 403-ing whole. Every messaging *mutation* stays
    behind Phase 6's gate.
    """

    permission_classes = [IsAuthenticated, IsActiveUser, IsBrokerMember]
    throttle_scope = "broker_dashboard"

    def get(self, request, broker_id):
        broker = get_object_or_404(BrokerOrganization, pk=broker_id)
        return Response(broker_dashboard_metrics(broker, viewer=request.user))


class BrokerSubscriptionView(BrokerTeamBaseView):
    """Billing state of the brokerage. Any member may read; team managers may start checkout."""

    # Billing must stay reachable in every status, including a brokerage that
    # was suspended for non-payment.
    permission_classes = [IsActiveUser, IsEmailVerified, IsBrokerBilling]

    def get(self, request, broker_id):
        from brokers.billing import trial_available
        from brokers.models import BrokerSubscription

        broker = self.get_broker()
        subscription = BrokerSubscription.objects.filter(broker=broker).first()
        plan = broker.plan
        return Response(
            {
                "broker_status": broker.status,
                "status": subscription.status if subscription else "INACTIVE",
                "current_period_end": subscription.current_period_end if subscription else None,
                "trial_ends_at": subscription.trial_ends_at if subscription else None,
                "trial_available": trial_available(broker),
                "trial_days": plan.trial_days if plan else 0,
                "past_due_since": subscription.past_due_since if subscription else None,
                "cancel_at_period_end": bool(subscription and subscription.cancel_at_period_end),
                "plan": (
                    {"name": plan.name, "monthly_price": str(plan.monthly_price), "currency": plan.currency}
                    if plan
                    else None
                ),
            }
        )

    def post(self, request, broker_id):
        from brokers.billing import create_subscription_checkout

        return Response(
            {"checkout_url": create_subscription_checkout(broker=self.get_broker())},
            status=status.HTTP_201_CREATED,
        )


class BrokerBillingPortalView(BrokerTeamBaseView):
    """POST -> a Stripe-hosted page with cards, tax details and invoices."""

    permission_classes = [IsActiveUser, IsEmailVerified, IsBrokerBilling]

    def post(self, request, broker_id):
        from brokers.billing import SUBSCRIPTION_PATH
        from brokers.models import BrokerSubscription
        from django.conf import settings

        from payments.portal import portal_url

        subscription = BrokerSubscription.objects.filter(broker=self.get_broker()).first()
        url = portal_url(
            customer_id=subscription.stripe_customer_id if subscription else "",
            return_url=f"{settings.PUBLIC_BASE_URL.rstrip('/')}{SUBSCRIPTION_PATH}",
        )
        return Response({"portal_url": url})

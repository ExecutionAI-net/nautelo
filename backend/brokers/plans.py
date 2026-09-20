"""Server-side enforcement of a broker plan's limits. A broker with no plan is unmanaged (unlimited)."""

from rest_framework import status
from rest_framework.exceptions import APIException

from brokers.models import BrokerMembership, BrokerOrganization

# Listings that still occupy a slot; archived, expired and rejected ones do not.
COUNTED_LISTING_STATES = ("DRAFT", "PENDING_APPROVAL", "PUBLISHED", "SUSPENDED")


class PlanLimitReached(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Your brokerage plan does not include more of this."
    default_code = "plan_limit_reached"


def listings_used(broker: BrokerOrganization) -> int:
    return broker.listings.filter(status__in=COUNTED_LISTING_STATES).count()


def seats_used(broker: BrokerOrganization) -> int:
    return BrokerMembership.objects.filter(broker=broker, is_active=True).count()


def plan_usage(broker: BrokerOrganization) -> dict:
    plan = broker.plan
    return {
        "plan": None
        if plan is None
        else {
            "slug": plan.slug,
            "name": plan.name,
            "tagline": plan.tagline,
            "monthly_price": str(plan.monthly_price),
            "currency": plan.currency,
            "listing_limit": plan.listing_limit,
            "seat_limit": plan.seat_limit,
            "profile_visibility": plan.get_profile_visibility_display(),
        },
        "renews_at": broker.plan_renews_at,
        "listings_used": listings_used(broker),
        "seats_used": seats_used(broker),
    }


def ensure_listing_capacity(broker: BrokerOrganization) -> None:
    plan = broker.plan
    if plan is not None and plan.listing_limit is not None and listings_used(broker) >= plan.listing_limit:
        raise PlanLimitReached(
            f"Your {plan.name} plan includes up to {plan.listing_limit} active listings.",
            code="plan_listing_limit_reached",
        )


def ensure_seat_capacity(broker: BrokerOrganization) -> None:
    plan = broker.plan
    if plan is not None and plan.seat_limit is not None and seats_used(broker) >= plan.seat_limit:
        raise PlanLimitReached(
            f"Your {plan.name} plan includes up to {plan.seat_limit} team seats.",
            code="plan_seat_limit_reached",
        )

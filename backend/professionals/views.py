"""Owner-side membership status and checkout for service professionals."""

from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from services_catalog.provider_views import IsServiceProvider

from .billing import create_membership_checkout, get_plan
from .access import membership_for, profile_for


def _profile(request):
    profile = profile_for(request.user)
    if profile is None:
        raise NotFound("Create your professional profile first.")
    return profile


class MembershipView(APIView):
    permission_classes = [IsServiceProvider]
    throttle_scope = "account"

    def get(self, request):
        plan = get_plan()
        profile = _profile(request)
        subscription = getattr(profile, "subscription", None)
        return Response(
            {
                "profile_status": profile.status,
                "status": subscription.status if subscription else "INACTIVE",
                "current_period_end": subscription.current_period_end if subscription else None,
                "past_due_since": subscription.past_due_since if subscription else None,
                "trial_ends_at": subscription.trial_ends_at if subscription else None,
                "trial_available": bool(plan and plan.trial_days > 0 and not (subscription and subscription.trial_used_at)),
                "trial_days": plan.trial_days if plan else 0,
                "plan": (
                    {
                        "name": plan.name,
                        "tagline": plan.tagline,
                        "monthly_price": str(plan.monthly_price),
                        "currency": plan.currency,
                    }
                    if plan
                    else None
                ),
            }
        )


class MembershipCheckoutView(APIView):
    permission_classes = [IsServiceProvider]
    throttle_scope = "checkout_create"

    def post(self, request):
        membership = membership_for(request.user)
        if membership is None or not membership.can_manage_team:
            raise PermissionDenied("Only team managers can manage billing.")
        return Response({"checkout_url": create_membership_checkout(profile=_profile(request))}, status=201)

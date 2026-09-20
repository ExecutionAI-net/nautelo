"""Owner-side membership status and checkout for service professionals."""

from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from services_catalog.provider_views import IsServiceProvider

from .billing import create_membership_checkout, get_plan
from .models import ProfessionalProfile


def _profile(request):
    profile = ProfessionalProfile.objects.filter(owner_user=request.user).first()
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
        return Response({"checkout_url": create_membership_checkout(profile=_profile(request))}, status=201)

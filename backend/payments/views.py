from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsEmailVerified

from .checkout import create_checkout_session
from .errors import IdempotencyKeyRequired
from .models import PaymentOrder
from .permissions import StripeCheckoutEnabled
from .serializers import CheckoutSessionRequestSerializer, PaymentOrderSerializer


class CheckoutSessionCreateView(APIView):
    """POST /api/v1/checkout-sessions/ (spec §30.1, §23.2).

    Permission ORDER is load-bearing and is pinned by tests. DRF stops at the
    first failing permission, so authentication comes first (an anonymous caller
    must not be able to probe our rollout state), verified email second (spec
    §12 item 3) and the feature flag last.
    """

    # `IsAuthenticated` first, matching every merged view in this project
    # (listings.views.ListingDraftCreateView is the precedent). It is defence in
    # depth rather than a new rule: `IsActiveUser` already refuses an anonymous
    # caller, so removing it changes no observable behaviour — which is why the
    # mutation check for it is a code-shape assertion, not a status-code one.
    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        IsEmailVerified,
        StripeCheckoutEnabled,
    ]
    # Spec §30.4 lists "Checkout creation" among the rate-limited surfaces.
    # Scope only — never throttle_classes (Phase 3 contract rule 9).
    throttle_scope = "checkout_create"

    def post(self, request):
        # BEFORE body validation, deliberately. Spec §30.3 makes the header a
        # PRECONDITION of the request, not a field of it, and a client making
        # both mistakes at once must be told about the systematic one rather
        # than handed a `validation_error` that hides it.
        key = request.headers.get("Idempotency-Key", "")
        if not key.strip():
            raise IdempotencyKeyRequired()

        envelope = CheckoutSessionRequestSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)

        result = create_checkout_session(
            user=request.user,
            product_code=envelope.validated_data["product_code"],
            listing_id=envelope.validated_data.get("listing_id"),
            return_url=envelope.validated_data.get("return_url"),
            client_idempotency_key=key,
            request_id=getattr(request, "request_id", None),
        )
        return Response(
            {
                "checkout_url": result.checkout_url,
                "order": PaymentOrderSerializer(result.order).data,
            },
            status=status.HTTP_201_CREATED if result.created else status.HTTP_200_OK,
        )


class PaymentOrderDetailView(APIView):
    """GET /api/v1/payment-orders/<id>/ (spec §30.1).

    Read-only by construction. Spec §23.3: the success page "polls/read-fetches
    order status ... It must never grant the right itself", so this view has no
    write handler and http_method_names excludes every mutating verb.

    It also never imports the fulfilment module, in any form. A test asserts
    that structurally, on the import statements rather than on the word — the
    word itself appears in this docstring on purpose.

    Scoped to the caller's own orders, so another user's id is a 404 rather than
    a 403 — a 403 would confirm the id exists (spec §33.1).
    """

    permission_classes = [IsAuthenticated, IsActiveUser]
    http_method_names = ["get", "options"]

    def get(self, request, order_id):
        order = get_object_or_404(
            PaymentOrder.objects.for_user(request.user).select_related(
                "product", "fulfilled_entitlement"
            ),
            pk=order_id,
        )
        return Response(PaymentOrderSerializer(order).data)

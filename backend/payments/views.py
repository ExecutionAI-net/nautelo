from django.conf import settings
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsEmailVerified, IsStaffAdmin

from .checkout import create_checkout_session
from .errors import IdempotencyKeyRequired
from .models import MarketplaceProduct, PaymentOrder
from .permissions import StripeCheckoutEnabled
from .serializers import (
    CheckoutSessionRequestSerializer,
    PaymentOrderSerializer,
    StaffProductSerializer,
    StaffProductUpdateSerializer,
)
from .services import update_product
from .webhooks import (
    DuplicateWebhookEvent,
    InvalidWebhookPayload,
    InvalidWebhookSignature,
    process_stripe_event,
    verify_stripe_event,
)


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
            quantity=envelope.validated_data.get("quantity", 1),
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


@method_decorator(csrf_exempt, name="dispatch")
class StripeWebhookView(APIView):
    """POST /api/v1/stripe/webhook/ (spec §30.1, §23.3).

    Unauthenticated (Stripe carries no JWT), unthrottled (throttling Stripe's
    retries would manufacture the paid-not-fulfilled state spec §35.4 tells us
    to watch for) and deliberately NOT gated by the
    `stripe_entitlement_checkout` flag — see the plan's ruling: turning the flag
    off between a customer paying and Stripe delivering must not strand a real
    payment.

    `request.body` is read BEFORE anything touches `request.data`: DRF's parsers
    consume the stream, and spec §33.1 requires verification against the raw
    bytes Django received. Never introduce a `request.data` access above this.
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ["post", "options"]

    def post(self, request):
        raw_body = request.body
        signature = request.META.get("HTTP_STRIPE_SIGNATURE", "")
        try:
            event = verify_stripe_event(
                raw_body=raw_body,
                signature_header=signature,
                secret=settings.STRIPE_WEBHOOK_SECRET,
            )
        except (InvalidWebhookSignature, InvalidWebhookPayload):
            # No body: distinguishing "bad timestamp" from "bad signature" would
            # be a signature oracle, and Stripe reads only the status code.
            return HttpResponse(status=400)

        try:
            process_stripe_event(event, raw_body=raw_body)
        except DuplicateWebhookEvent:
            # Spec §23.3 step 3: "duplicate event ID returns HTTP 200 without
            # re-fulfillment".
            return HttpResponse(status=200)
        # Any other exception propagates to a 500 on purpose, so Stripe retries.
        return HttpResponse(status=200)


class StaffProductBaseView(APIView):
    """Spec §5: "Configure products/settings" is staff-admin only, and spec §12
    is explicit that a moderator may not change payment products. Permission
    order matters (DRF stops at the first failure): authentication, then
    verified email, then the staff-admin group."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsEmailVerified, IsStaffAdmin]


class StaffProductListView(StaffProductBaseView):
    """GET /api/v1/staff/products/ (spec §30.1).

    No POST: spec §23.1 fixes the catalogue at exactly two codes, and a third
    product would have no code path anywhere else in the system.
    """

    http_method_names = ["get", "options"]

    def get(self, request):
        products = MarketplaceProduct.objects.all()
        return Response(
            StaffProductSerializer(
                products, many=True, context={"check_price": False}
            ).data
        )


class StaffProductDetailView(StaffProductBaseView):
    """GET/PATCH /api/v1/staff/products/<id>/ (spec §30.1, §23.5, §26.4)."""
    throttle_scope = "staff_moderation"

    http_method_names = ["get", "patch", "options"]

    def get_product(self, product_id):
        return get_object_or_404(MarketplaceProduct, pk=product_id)

    def get(self, request, product_id):
        product = self.get_product(product_id)
        return Response(
            StaffProductSerializer(product, context={"check_price": True}).data
        )

    def patch(self, request, product_id):
        product = self.get_product(product_id)
        envelope = StaffProductUpdateSerializer(
            product, data=request.data, partial=True
        )
        envelope.is_valid(raise_exception=True)
        updated = update_product(
            product=product,
            changes=envelope.validated_data,
            actor=request.user,
            request_id=getattr(request, "request_id", None),
        )
        return Response(
            StaffProductSerializer(updated, context={"check_price": False}).data
        )

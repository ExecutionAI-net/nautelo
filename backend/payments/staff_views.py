"""Staff-facing read view over PaymentOrder (spec §4 /dashboard/staff/purchases/).

Read-only by design - same rule payments/admin.py's PaymentOrderAdmin already
enforces (spec §26.3 / §23.1: staff never edits a Stripe-paid order manually).
This view only ever returns identifiers, an amount and a currency - see this
module's sibling payments/models.py docstring: no card data is ever stored,
so none can leak here either.
"""

from common.money import display_money
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsStaffAdmin

from .models import PaymentOrder


class StaffPurchaseSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    product_name = serializers.CharField(source="product.name_en", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)
    amount_display = serializers.SerializerMethodField()

    class Meta:
        model = PaymentOrder
        fields = (
            "id", "user_email", "product_name", "product_code", "quantity",
            "amount_display", "status", "stripe_checkout_session_id",
            "stripe_payment_intent_id", "created_at", "paid_at", "fulfilled_at",
        )

    def get_amount_display(self, obj) -> str:
        return display_money(obj.amount, obj.currency)


def _order_row(order) -> dict:
    row = StaffPurchaseSerializer(order).data
    # The serializer renders timestamps as strings; keep the datetimes so
    # rows from the three sources sort together (DRF re-renders them).
    row.update({"created_at": order.created_at, "paid_at": order.paid_at, "fulfilled_at": order.fulfilled_at})
    row["kind"] = "Order"
    row["detail"] = f"x{order.quantity}" if order.quantity > 1 else ""
    return row


def _promotion_row(promotion) -> dict:
    if promotion.listing_id:
        listing = promotion.listing
        target = f"{listing.manufacture_year} {listing.brand.name} {listing.custom_model_name or listing.model.name}"
    else:
        target = promotion.professional.display_name if promotion.professional_id else ""
    return {
        "id": str(promotion.pk),
        "kind": "Promotion",
        "user_email": promotion.user.email,
        "product_name": f"{promotion.plan.name_en} ({promotion.days} days)",
        "product_code": f"PROMOTION_{promotion.plan.code}".upper(),
        "detail": target,
        "quantity": 1,
        "amount_display": display_money(promotion.amount, promotion.currency),
        "status": promotion.status,
        "stripe_checkout_session_id": promotion.stripe_checkout_session_id,
        "stripe_payment_intent_id": promotion.stripe_payment_intent_id,
        "created_at": promotion.created_at,
        "paid_at": promotion.paid_at,
        "fulfilled_at": promotion.starts_at,
    }


def _subscription_row(subscription, *, kind, owner_email, product_name, detail, price, currency) -> dict:
    return {
        "id": str(subscription.pk),
        "kind": kind,
        "user_email": owner_email,
        "product_name": product_name,
        "product_code": kind.upper().replace(" ", "_"),
        "detail": detail,
        "quantity": 1,
        "amount_display": f"{display_money(price, currency)}/month" if price is not None else "",
        "status": subscription.status,
        "stripe_checkout_session_id": subscription.stripe_customer_id,
        "stripe_payment_intent_id": subscription.stripe_subscription_id,
        "created_at": subscription.created_at,
        "paid_at": subscription.last_paid_at,
        "fulfilled_at": subscription.current_period_end,
    }


def _broker_rows():
    from brokers.models import BrokerMembership, BrokerSubscription

    rows = []
    for sub in BrokerSubscription.objects.select_related("broker", "broker__plan").exclude(status="INACTIVE"):
        owner = (
            BrokerMembership.objects.filter(broker=sub.broker, is_active=True, can_manage_team=True)
            .select_related("user")
            .order_by("created_at")
            .first()
        )
        plan = sub.broker.plan
        rows.append(
            _subscription_row(
                sub,
                kind="Broker subscription",
                owner_email=owner.user.email if owner else "",
                product_name=plan.name if plan else "",
                detail=sub.broker.name,
                price=plan.monthly_price if plan else None,
                currency=plan.currency if plan else "",
            )
        )
    return rows


def _professional_rows():
    from professionals.billing import get_plan
    from professionals.models import ProfessionalSubscription

    plan = get_plan()
    rows = []
    for sub in ProfessionalSubscription.objects.select_related("profile", "profile__owner_user").exclude(status="INACTIVE"):
        rows.append(
            _subscription_row(
                sub,
                kind="Professional membership",
                owner_email=sub.profile.owner_user.email,
                product_name=plan.name if plan else "",
                detail=sub.profile.display_name,
                price=plan.monthly_price if plan else None,
                currency=plan.currency if plan else "",
            )
        )
    return rows


SEARCHED_KEYS = ("user_email", "stripe_checkout_session_id", "stripe_payment_intent_id", "product_code", "detail", "kind")


def _matches(row: dict, term: str) -> bool:
    term = term.lower()
    return any(term in str(row[key] or "").lower() for key in SEARCHED_KEYS)


class StaffPurchaseListView(APIView):
    """GET /api/v1/staff/purchases/?q=&status=&kind=&page= - every purchase on
    the platform in one ledger: one-time orders (listing packages, media
    upgrades), listing/profile promotions, and broker/professional
    subscriptions, each with its Stripe identifiers for support lookups.

    Three models merged in Python rather than a database union: the volumes
    are small and the columns differ; the page contract (count/next/previous/
    results/facets) is what frontend's StaffDataTable already reads."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"
    page_size = 25

    def get(self, request):
        from promotions.models import ListingPromotion

        params = request.query_params
        rows = [_order_row(order) for order in PaymentOrder.objects.select_related("user", "product").order_by("-created_at")]
        rows += [
            _promotion_row(promotion)
            for promotion in ListingPromotion.objects.select_related(
                "user", "plan", "listing", "listing__brand", "listing__model", "professional"
            )
        ]
        rows += _broker_rows() + _professional_rows()
        rows.sort(key=lambda row: row["created_at"], reverse=True)

        term = params.get("q", "").strip()
        if term:
            rows = [row for row in rows if _matches(row, term)]
        kind = params.get("kind", "").strip()
        if kind:
            rows = [row for row in rows if row["kind"] == kind]
        facets: dict[str, int] = {}
        for row in rows:
            facets[row["status"]] = facets.get(row["status"], 0) + 1
        status = params.get("status", "").strip()
        if status:
            rows = [row for row in rows if row["status"] == status]

        page = _int(params.get("page"), 1, minimum=1)
        size = _int(params.get("page_size"), self.page_size, minimum=1, maximum=100)
        start = (page - 1) * size
        return Response(
            {
                "count": len(rows),
                "next": page + 1 if start + size < len(rows) else None,
                "previous": page - 1 if page > 1 else None,
                "results": rows[start : start + size],
                "facets": facets,
            }
        )


def _int(raw, default, *, minimum, maximum=None):
    try:
        value = int(raw) if raw not in (None, "") else default
    except ValueError:
        value = default
    value = max(value, minimum)
    return min(value, maximum) if maximum else value

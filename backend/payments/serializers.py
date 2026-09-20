from rest_framework import serializers

from .enums import ProductCode
from .models import MarketplaceProduct, PaymentOrder
from .products import check_stripe_price
from .selectors import product_operations


class CheckoutSessionRequestSerializer(serializers.Serializer):
    """Spec §23.2's request body — and nothing else.

    A plain Serializer with exactly three declared fields: DRF ignores unknown
    keys, so `amount`, `currency`, `price_id` and `quantity` sent by a client
    are silently dropped rather than honoured. That is spec §2.2's server
    authority and §23.2's "client cannot submit amount/currency".
    """

    product_code = serializers.ChoiceField(choices=ProductCode.choices)
    listing_id = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.IntegerField(required=False, min_value=1, max_value=20, default=1)
    package = serializers.SlugField(required=False, allow_blank=True, default="")
    return_url = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, max_length=200
    )


class PaymentOrderSerializer(serializers.ModelSerializer):
    """Spec §30.1's "poll fulfillment state" payload.

    Carries no Stripe session id, no payment intent id and no Stripe URL: the
    client already has the URL it was handed, and echoing Stripe identifiers
    back to a browser widens the blast radius of an XSS for no product benefit.
    """

    product_code = serializers.CharField(source="product.code", read_only=True)
    # Spec §30.2: "JSON uses decimal strings for money".
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)
    entitlement_id = serializers.PrimaryKeyRelatedField(
        source="fulfilled_entitlement", read_only=True
    )

    class Meta:
        model = PaymentOrder
        fields = (
            "id",
            "status",
            "product_code",
            "listing_id",
            "amount",
            "currency",
            "quantity",
            "entitlement_id",
            "created_at",
            "paid_at",
            "fulfilled_at",
        )
        read_only_fields = fields


class StaffProductSerializer(serializers.ModelSerializer):
    """Every field spec §23.5's card shows, and nothing a customer may see."""

    display_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, coerce_to_string=True, read_only=True
    )
    price_state = serializers.SerializerMethodField()
    price_reason = serializers.SerializerMethodField()
    stripe_unit_amount = serializers.SerializerMethodField()
    operations = serializers.SerializerMethodField()

    class Meta:
        model = MarketplaceProduct
        fields = (
            "id", "code",
            "name_en", "name_it", "name_es",
            "description_en", "description_it", "description_es",
            "is_active", "display_amount", "currency",
            "stripe_product_id", "stripe_price_id",
            "entitlement_valid_days", "publication_days", "display_order",
            "price_state", "price_reason", "stripe_unit_amount",
            "operations", "updated_at",
        )
        read_only_fields = fields

    def _check(self, product):
        """One Stripe call per rendered product, so only the DETAIL view asks
        for it (context flag `check_price`)."""
        if not self.context.get("check_price"):
            return None
        if "_price_check" not in self.context:
            try:
                self.context["_price_check"] = check_stripe_price(product)
            except Exception:  # PaymentGatewayUnavailable and anything below it
                self.context["_price_check"] = None
        return self.context["_price_check"]

    def get_price_state(self, product):
        if not self.context.get("check_price"):
            return "UNCHECKED"
        result = self._check(product)
        if result is None:
            return "UNAVAILABLE"
        return "OK" if result.ok else "MISMATCH"

    def get_price_reason(self, product):
        result = self._check(product)
        return "" if result is None else result.reason

    def get_stripe_unit_amount(self, product):
        result = self._check(product)
        return None if result is None else result.stripe_unit_amount

    def get_operations(self, product):
        return product_operations(product).as_dict()


class StaffProductUpdateSerializer(serializers.ModelSerializer):
    """Spec §26.4's editable set. `code` is absent by construction."""

    class Meta:
        model = MarketplaceProduct
        fields = (
            "name_en", "name_it", "name_es",
            "description_en", "description_it", "description_es",
            "stripe_product_id", "stripe_price_id",
            "currency", "display_amount",
            "entitlement_valid_days", "publication_days",
            "is_active", "display_order",
        )

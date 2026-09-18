from rest_framework import serializers

from .enums import ProductCode
from .models import PaymentOrder


class CheckoutSessionRequestSerializer(serializers.Serializer):
    """Spec §23.2's request body — and nothing else.

    A plain Serializer with exactly three declared fields: DRF ignores unknown
    keys, so `amount`, `currency`, `price_id` and `quantity` sent by a client
    are silently dropped rather than honoured. That is spec §2.2's server
    authority and §23.2's "client cannot submit amount/currency".
    """

    product_code = serializers.ChoiceField(choices=ProductCode.choices)
    listing_id = serializers.UUIDField(required=False, allow_null=True)
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
            "entitlement_id",
            "created_at",
            "paid_at",
            "fulfilled_at",
        )
        read_only_fields = fields

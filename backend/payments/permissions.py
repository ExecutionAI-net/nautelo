from rest_framework.permissions import BasePermission

from platform_settings.services import is_feature_enabled

from .enums import STRIPE_CHECKOUT_FLAG


class StripeCheckoutEnabled(BasePermission):
    """Spec §35.1: `stripe_entitlement_checkout` gates backend mutation, not
    just UI.

    Deliberately NOT applied to the webhook: turning the flag off between a
    customer paying and Stripe delivering would strand a real payment with no
    entitlement — exactly the paid-not-fulfilled state spec §35.4 tells us to
    monitor for. The flag stops NEW purchases; in-flight ones still land.
    """

    message = "This feature is not enabled yet."
    code = "feature_disabled"

    def has_permission(self, request, view):
        return is_feature_enabled(STRIPE_CHECKOUT_FLAG, default=False)

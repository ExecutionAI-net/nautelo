"""Checkout Session creation (spec §23.2).

The order of operations is fixed by the spec and by safety, in this sequence:

  1. Resolve the product and refuse an inactive one   (§23.2 "Product must be active")
  2. Reconcile the stored price against Stripe        (§23.5 "blocked until reconciled")
  3. Validate the listing binding                     (§23.2 media-upgrade rule)
  4. Validate the return URL                          (§33.1 open-redirect rule)
  5. Create the local PaymentOrder                    (§23.2 "before Stripe session")
  6. Create the Stripe session with a deterministic idempotency key
  7. Record the session id and move to CHECKOUT_OPEN

Steps 1-4 happen BEFORE any row is written, so a refused request leaves no
orphan order behind. Step 6 happens AFTER the order's transaction has committed,
deliberately: a network call inside a transaction holds row locks open for the
length of an HTTP round trip to a third party.
"""

from dataclasses import dataclass
from urllib.parse import urlencode

from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from audit.models import AuditEvent
from audit.services import record_audit_event
from entitlements.enums import EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from listings.enums import ListingStatus
from listings.models import BoatListing
from accounts.enums import SellerType

from .enums import LISTING_BOUND_PRODUCTS, PaymentOrderStatus, ProductCode

# Stripe Checkout's supported locales that the platform also speaks. Without
# an explicit locale Stripe follows the browser, which showed a Turkish
# checkout (and a TRY price under adaptive pricing) to an EN account.
CHECKOUT_LOCALES = {"EN": "en", "IT": "it", "ES": "es"}


def checkout_locale(user) -> str:
    """The Stripe `locale` for this account: its own language, else English."""
    return CHECKOUT_LOCALES.get((getattr(user, "locale", "") or "").upper(), "en")
from .errors import (
    CheckoutNotOpen,
    IdempotencyKeyRequired,
    ProductNotAvailable,
    IdempotencyKeyReused,
    InvalidReturnUrl,
    ListingNotUpgradable,
    ListingRequiredForProduct,
    PaymentGatewayUnavailable,
)
from .gateway import StripeUnavailable, default_gateway
from .models import ListingPackage, MarketplaceProduct, PaymentOrder
from .products import get_purchasable_product, require_reconciled_price

# Spec §23.2: "Success/cancel URLs are allowlisted local routes."
# Spec §33.1: "Allowlist local return URLs; prevent open redirects."
# Every member is a spec §4.1/§4.2 route. Membership is exact-match against this
# frozenset — NOT a prefix check, NOT a host check on a caller-supplied absolute
# URL — which is what makes `//evil.example`, `/sell/../x` and
# `https://nautelo.example.evil.test/sell/` structurally unable to pass.
RETURN_URL_ALLOWLIST: frozenset[str] = frozenset(
    {
        "/dashboard/private-seller/listings/",  # spec §23.2's worked example
        "/dashboard/private-seller/",           # spec §4.2
        "/sell/",                               # spec §4.1
        "/sell/create/",                        # spec §4.1
    }
)
DEFAULT_RETURN_URL = "/dashboard/private-seller/listings/"

# Listing rights can be bought several at a time; nothing else can.
MAX_LISTING_RIGHT_QUANTITY = 20

# Spec §23.1: the upgrade applies to a listing that can still be published.
UPGRADABLE_LISTING_STATES: frozenset[str] = frozenset(
    {
        ListingStatus.DRAFT,
        ListingStatus.PENDING_APPROVAL,
        ListingStatus.PUBLISHED,
        ListingStatus.REJECTED,
        ListingStatus.SUSPENDED,
    }
)


def build_return_urls(order_id, return_url: str | None) -> tuple[str, str]:
    """(success_url, cancel_url), both absolute and both locally-owned."""
    path = DEFAULT_RETURN_URL if return_url is None else return_url
    if path not in RETURN_URL_ALLOWLIST:
        raise InvalidReturnUrl()

    base = settings.PUBLIC_BASE_URL.rstrip("/")

    def _url(outcome: str) -> str:
        query = urlencode({"order": str(order_id), "checkout": outcome})
        return f"{base}{path}?{query}"

    return _url("success"), _url("cancelled")


def assert_listing_is_upgradable(*, user, listing) -> None:
    """Spec §23.2: "Media upgrade requires a private listing owned by the user
    and not already upgraded"."""
    if listing is None:
        raise ListingNotUpgradable()
    if listing.seller_type != SellerType.PRIVATE or listing.owner_user_id != user.pk:
        raise ListingNotUpgradable()
    if listing.status not in UPGRADABLE_LISTING_STATES:
        raise ListingNotUpgradable()
    already = (
        UserEntitlement.objects.filter(
            listing=listing, entitlement_type=EntitlementType.MEDIA_UPGRADE
        )
        .exclude(state=EntitlementState.REVOKED)
        .exists()
    )
    if already:
        raise ListingNotUpgradable()


def _resolve_listing(*, user, product_code, listing_id):
    """The listing this order binds to, or None.

    A missing listing and another user's listing raise the SAME error, so the
    endpoint cannot be used to test whether a listing id exists (spec §33.1's
    IDOR rule).
    """
    binds = product_code in LISTING_BOUND_PRODUCTS
    if not binds:
        if listing_id:
            # A listing right is consumed at submit (spec §6.3), never bound at
            # purchase. Accepting an id would create a binding nothing honours.
            raise ListingNotUpgradable()
        return None
    if not listing_id:
        raise ListingRequiredForProduct()

    listing = BoatListing.objects.filter(pk=listing_id).first()
    assert_listing_is_upgradable(user=user, listing=listing)
    return listing


def _request_fingerprint(product_code, listing, return_url, quantity=1, package_slug="") -> str:
    listing_part = "" if listing is None else str(listing.pk)
    return f"{product_code}|{listing_part}|{return_url or DEFAULT_RETURN_URL}|{quantity}|{package_slug}"


@dataclass(frozen=True)
class CheckoutResult:
    order: PaymentOrder
    checkout_url: str
    created: bool


def create_checkout_session(
    *,
    user,
    product_code: str,
    listing_id=None,
    return_url: str | None = None,
    quantity: int = 1,
    package_slug: str | None = None,
    client_idempotency_key: str,
    request_id: str | None = None,
    gateway=None,
) -> CheckoutResult:
    if not (client_idempotency_key or "").strip():
        raise IdempotencyKeyRequired()
    client_idempotency_key = client_idempotency_key.strip()
    gateway = gateway or default_gateway()

    package = None
    if package_slug:
        # A package carries its own price and Stripe ids; the product row only
        # names the kind of right that is granted.
        package = ListingPackage.objects.filter(slug=package_slug, is_active=True).first()
        product = MarketplaceProduct.objects.filter(code=product_code).first()
        if package is None or product is None or product_code != ProductCode.INDIVIDUAL_LISTING_RIGHT:
            raise ProductNotAvailable(product_code=product_code)
        require_reconciled_price(package, gateway=gateway)
    else:
        product = get_purchasable_product(product_code)
        require_reconciled_price(product, gateway=gateway)
    listing = _resolve_listing(
        user=user, product_code=product.code, listing_id=listing_id
    )
    if product.code in LISTING_BOUND_PRODUCTS:
        quantity = 1
    quantity = max(1, min(int(quantity or 1), MAX_LISTING_RIGHT_QUANTITY))
    fingerprint = _request_fingerprint(product.code, listing, return_url, quantity, package_slug or "")
    # Validate the return URL before writing anything, so a hostile one leaves
    # no order behind.
    build_return_urls("probe", return_url)

    existing = PaymentOrder.objects.filter(
        user=user, client_idempotency_key=client_idempotency_key
    ).first()
    if existing is not None:
        return _replay(existing, fingerprint, return_url, gateway, request_id)

    # The same purchase started again (the buyer backed out of Stripe's page
    # and clicked Buy once more) goes back to the session that is still open
    # rather than opening a second one: one order per purchase in the ledger,
    # and no stale link that could be paid later by mistake.
    reusable = _open_session_for(user, fingerprint)
    if reusable is not None:
        return CheckoutResult(
            order=reusable, checkout_url=reusable.metadata["checkout_url"], created=False
        )

    try:
        with transaction.atomic():
            order = PaymentOrder(
                user=user,
                product=product,
                listing=listing,
                status=PaymentOrderStatus.CREATED,
                amount=(package or product).display_amount * quantity,
                package=package,
                quantity=quantity,
                currency=(package or product).currency.upper(),
                client_idempotency_key=client_idempotency_key,
                metadata={
                    "request_fingerprint": fingerprint,
                    "return_url": return_url or DEFAULT_RETURN_URL,
                },
            )
            # Spec §23.2: "an idempotency key derived from order UUID and
            # operation". `order.pk` is populated by UUIDModel's default before
            # the INSERT, so it is available here.
            order.idempotency_key = f"checkout:{order.pk}"
            order.save()
            record_audit_event(
                actor_user=user,
                actor_type=AuditEvent.ActorType.USER,
                action="payment_order.created",
                target_type="payments.PaymentOrder",
                target_id=str(order.pk),
                source=AuditEvent.Source.API,
                after={"status": order.status, "amount": str(order.amount),
                       "currency": order.currency},
                request_id=request_id,
                metadata={"product_code": product.code},
            )
    except IntegrityError:
        # Two concurrent requests with the same key: the loser re-reads the
        # winner's row rather than opening a second Stripe session.
        existing = PaymentOrder.objects.get(
            user=user, client_idempotency_key=client_idempotency_key
        )
        return _replay(existing, fingerprint, return_url, gateway, request_id)

    url = _open_stripe_session(order, return_url, gateway, request_id)
    return CheckoutResult(order=order, checkout_url=url, created=True)


# Stripe closes a Checkout 24 hours after creation; a session younger than this
# is still payable and worth sending the buyer back to.
OPEN_SESSION_REUSE_WINDOW = timedelta(hours=23)


def _open_session_for(user, fingerprint):
    return (
        PaymentOrder.objects.filter(
            user=user,
            status=PaymentOrderStatus.CHECKOUT_OPEN,
            metadata__request_fingerprint=fingerprint,
            created_at__gt=timezone.now() - OPEN_SESSION_REUSE_WINDOW,
        )
        .exclude(metadata__checkout_url="")
        .order_by("-created_at")
        .first()
    )


def cancel_checkout_session(*, user, order_id, gateway=None, request_id=None) -> PaymentOrder:
    """The buyer left Stripe's page through its back link: close the session
    there and record the order as expired here, so the ledger says what
    happened now rather than when Stripe's 24-hour clock runs out."""
    gateway = gateway or default_gateway()
    with transaction.atomic():
        order = (
            PaymentOrder.objects.for_user(user).select_for_update().filter(pk=order_id).first()
        )
        if order is None or order.status != PaymentOrderStatus.CHECKOUT_OPEN:
            raise CheckoutNotOpen()
        try:
            gateway.expire_checkout_session(order.stripe_checkout_session_id)
        except StripeUnavailable as exc:
            # Paid in the meantime, or Stripe is down: the webhook remains the
            # authority, and the order is left as it is.
            raise PaymentGatewayUnavailable() from exc
        before = {"status": order.status}
        order.status = PaymentOrderStatus.EXPIRED
        order.save(update_fields=["status", "updated_at"])
        record_audit_event(
            actor_user=user,
            actor_type=AuditEvent.ActorType.USER,
            action="payment_order.cancelled",
            target_type="payments.PaymentOrder",
            target_id=str(order.pk),
            source=AuditEvent.Source.API,
            before=before,
            after={"status": order.status},
            request_id=request_id,
        )
    return order


def _replay(order, fingerprint, return_url, gateway, request_id) -> CheckoutResult:
    """Spec §30.3's safe replay."""
    if order.metadata.get("request_fingerprint") != fingerprint:
        raise IdempotencyKeyReused()
    if order.status == PaymentOrderStatus.CREATED:
        # The first attempt never got a session (Stripe was unreachable). Retry
        # with the SAME deterministic key, so a session Stripe did in fact
        # create is returned rather than duplicated.
        url = _open_stripe_session(order, return_url, gateway, request_id)
        return CheckoutResult(order=order, checkout_url=url, created=False)
    return CheckoutResult(
        order=order,
        checkout_url=order.metadata.get("checkout_url", ""),
        created=False,
    )


def _open_stripe_session(order, return_url, gateway, request_id) -> str:
    success_url, cancel_url = build_return_urls(order.pk, return_url)
    params = {
        "mode": "payment",
        # Spec §23.2: "Server loads Stripe Price; client cannot submit
        # amount/currency." The price id IS the amount; no number is sent.
        "line_items": [
            {
                "price": (order.package or order.product).stripe_price_id,
                "quantity": order.quantity,
            }
        ],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "locale": checkout_locale(order.user),
        "client_reference_id": str(order.pk),
        # Spec §23.2: "Store internal order/user/product identifiers in Stripe
        # metadata, not personal message content." No email, no name, no listing
        # title. `customer_email` is deliberately NOT set: Stripe collects it
        # itself on its own hosted page, so pre-filling it would export a
        # personal identifier we do not need to export (spec §33.2).
        "metadata": {
            "order_id": str(order.pk),
            "user_id": str(order.user_id),
            "product_code": order.product.code,
            "listing_id": "" if order.listing_id is None else str(order.listing_id),
            "quantity": str(order.quantity),
            "package": "" if order.package_id is None else order.package.slug,
        },
    }
    try:
        result = gateway.create_checkout_session(
            params=params, idempotency_key=order.idempotency_key
        )
    except StripeUnavailable as exc:
        # The order stays CREATED and is retriable with the same client key.
        raise PaymentGatewayUnavailable() from exc

    with transaction.atomic():
        locked = PaymentOrder.objects.select_for_update().get(pk=order.pk)
        before = {"status": locked.status}
        locked.status = PaymentOrderStatus.CHECKOUT_OPEN
        locked.stripe_checkout_session_id = result.session_id
        locked.metadata = {**locked.metadata, "checkout_url": result.url}
        locked.save(
            update_fields=[
                "status",
                "stripe_checkout_session_id",
                "metadata",
                "updated_at",
            ]
        )
        record_audit_event(
            actor_user=locked.user,
            actor_type=AuditEvent.ActorType.USER,
            action="payment_order.checkout_opened",
            target_type="payments.PaymentOrder",
            target_id=str(locked.pk),
            source=AuditEvent.Source.API,
            before=before,
            after={"status": locked.status,
                   "stripe_checkout_session_id": result.session_id},
            request_id=request_id,
        )
    order.refresh_from_db()
    return result.url

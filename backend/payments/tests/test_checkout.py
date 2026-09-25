"""Spec §23.2's Checkout creation rules, one test per bullet."""

from decimal import Decimal

import pytest
from django.utils import timezone

from audit.models import AuditEvent
from entitlements.enums import EntitlementState, EntitlementType
from entitlements.tests.factories import make_entitlement
from listings.enums import ListingStatus
from listings.tests.factories import make_brand, make_private_listing
from payments.checkout import (
    cancel_checkout_session,
    DEFAULT_RETURN_URL,
    RETURN_URL_ALLOWLIST,
    build_return_urls,
    create_checkout_session,
)
from payments.enums import PaymentOrderStatus, ProductCode
from payments.errors import (
    CheckoutNotOpen,
    InvalidReturnUrl,
    ListingNotUpgradable,
    ListingRequiredForProduct,
    PaymentGatewayUnavailable,
    ProductNotAvailable,
    ProductPriceMismatch,
)
from payments.gateway import PriceSnapshot, StripeUnavailable
from payments.models import PaymentOrder
from payments.tests.factories import (
    listing_right_product,
    make_payments_seller,
    media_upgrade_product,
)
from payments.tests.fakes import FakeStripeGateway

# make_private_listing(owner=...) derives its brand name from the OWNER's pk
# (f"Brand {owner.pk.hex[:8]}", see listings/tests/factories.py) and
# BoatBrand.normalized_name is unique=True — so a SECOND listing for the SAME
# owner in one test must be given its own brand or the insert dies with an
# IntegrityError before the assertion under test is ever reached.


@pytest.fixture
def seller(db):
    return make_payments_seller()


@pytest.fixture
def gateway():
    return FakeStripeGateway()


def upgrade_gateway():
    return FakeStripeGateway(
        price=PriceSnapshot(
            price_id="price_test_media_upgrade",
            product_id="prod_test_media_upgrade",
            unit_amount=1900,
            currency="eur",
            active=True,
            recurring=False,
        )
    )


@pytest.mark.django_db
def test_the_allowlist_holds_only_spec_4_routes():
    assert RETURN_URL_ALLOWLIST == {
        "/dashboard/private-seller/listings/",
        "/dashboard/private-seller/",
        "/sell/",
        "/sell/create/",
    }
    assert DEFAULT_RETURN_URL in RETURN_URL_ALLOWLIST


@pytest.mark.django_db
def test_the_success_and_cancel_urls_are_built_from_public_base_url(settings):
    settings.PUBLIC_BASE_URL = "https://nautelo.example"

    success, cancel = build_return_urls("order-1", "/sell/")

    assert success == (
        "https://nautelo.example/sell/?order=order-1&checkout=success"
    )
    assert cancel == "https://nautelo.example/sell/?order=order-1&checkout=cancelled"


@pytest.mark.django_db
def test_a_trailing_slash_on_public_base_url_does_not_double_up(settings):
    settings.PUBLIC_BASE_URL = "https://nautelo.example/"

    success, _ = build_return_urls("order-1", "/sell/")

    assert success.startswith("https://nautelo.example/sell/")


@pytest.mark.django_db
def test_a_missing_return_url_falls_back_to_the_default(settings):
    settings.PUBLIC_BASE_URL = "https://nautelo.example"

    success, _ = build_return_urls("order-1", None)

    assert success.startswith(f"https://nautelo.example{DEFAULT_RETURN_URL}")


@pytest.mark.django_db
@pytest.mark.parametrize(
    "hostile",
    [
        "https://evil.example/steal",
        "http://evil.example",
        "//evil.example",
        "///evil.example",
        "\\\\evil.example",
        "/\\evil.example",
        "https://nautelo.example.evil.test/sell/",
        "/sell/../../etc/passwd",
        "/sell/%2e%2e/",
        "/sell/?next=https://evil.example",
        # Response-splitting through the Location header Stripe will emit.
        "/sell/%0d%0aSet-Cookie:session=attacker",
        "/sell/\r\nSet-Cookie:session=attacker",
        # userinfo tricks: everything before the @ is credentials, not a host.
        "/sell/@evil.example",
        "https://nautelo.example@evil.example/sell/",
        "//user:pass@evil.example/sell/",
        "/sell",           # not the allowlisted spelling
        "/SELL/",          # case must match exactly
        "javascript:alert(1)",
        "data:text/html,<script>",
        "/dashboard/private-seller/listings/extra/",
        "",
        "   ",
    ],
)
def test_every_non_allowlisted_return_url_is_refused(hostile):
    """Spec §33.1: "Allowlist local return URLs; prevent open redirects." This
    implementation never parses a caller-supplied host at all — membership in a
    frozenset of paths is not a prefix match, so none of these can pass."""
    with pytest.raises(InvalidReturnUrl) as excinfo:
        build_return_urls("order-1", hostile)

    assert excinfo.value.get_codes() == "invalid_return_url"


@pytest.mark.django_db
def test_a_successful_checkout_creates_the_order_before_the_stripe_call(
    seller, gateway
):
    """Spec §23.2: "Create local PaymentOrder before Stripe session"."""
    listing_right_product()

    result = create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        return_url="/sell/",
        client_idempotency_key="idem-1",
        gateway=gateway,
    )

    order = result.order
    assert result.created is True
    assert order.status == PaymentOrderStatus.CHECKOUT_OPEN
    assert order.stripe_checkout_session_id == "cs_test_fake"
    assert order.amount == Decimal("49.00")
    assert order.currency == "EUR"
    # Spec §23.2: "Use an idempotency key derived from order UUID and operation."
    assert order.idempotency_key == f"checkout:{order.pk}"
    assert gateway.created[0]["idempotency_key"] == f"checkout:{order.pk}"


@pytest.mark.django_db
def test_the_amount_sent_to_stripe_is_a_price_id_not_a_number(seller, gateway):
    """Spec §23.2: "Server loads Stripe Price; client cannot submit
    amount/currency." The params must reference the price, never quote one."""
    listing_right_product()

    create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="idem-1",
        gateway=gateway,
    )

    params = gateway.created[0]["params"]
    assert params["line_items"] == [
        {"price": "price_test_listing_right", "quantity": 1}
    ]
    assert params["mode"] == "payment"
    assert "amount" not in params
    assert "unit_amount" not in params
    assert "price_data" not in params


@pytest.mark.django_db
def test_stripe_metadata_carries_internal_ids_and_no_personal_data(seller, gateway):
    """Spec §23.2: "Store internal order/user/product identifiers in Stripe
    metadata, not personal message content." Spec §33.2 adds the privacy rule."""
    listing_right_product()

    result = create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="idem-1",
        gateway=gateway,
    )

    metadata = gateway.created[0]["params"]["metadata"]
    assert metadata == {
        "order_id": str(result.order.pk),
        "user_id": str(seller.pk),
        "product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT,
        "listing_id": "",
        "quantity": "1",
        "package": "",
    }
    flattened = str(gateway.created[0]["params"])
    assert seller.email not in flattened
    assert "customer_email" not in gateway.created[0]["params"]


@pytest.mark.django_db
def test_an_inactive_product_never_reaches_stripe(seller, gateway):
    with pytest.raises(ProductNotAvailable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            client_idempotency_key="idem-1",
            gateway=gateway,
        )

    assert gateway.created == []
    assert PaymentOrder.objects.count() == 0


@pytest.mark.django_db
def test_a_price_mismatch_blocks_checkout_and_writes_no_order(seller):
    """Spec §23.5: "Checkout is blocked until reconciled"."""
    listing_right_product(display_amount=Decimal("59.00"))
    gateway = FakeStripeGateway()  # its default price is 4900

    with pytest.raises(ProductPriceMismatch):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            client_idempotency_key="idem-1",
            gateway=gateway,
        )

    assert gateway.created == []
    assert PaymentOrder.objects.count() == 0


@pytest.mark.django_db
def test_replaying_the_same_idempotency_key_returns_the_same_order(seller, gateway):
    """Spec §30.3: "Store outcome for safe replay"."""
    listing_right_product()
    kwargs = dict(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        return_url="/sell/",
        client_idempotency_key="idem-1",
        gateway=gateway,
    )

    first = create_checkout_session(**kwargs)
    second = create_checkout_session(**kwargs)

    assert second.created is False
    assert second.order.pk == first.order.pk
    assert second.checkout_url == first.checkout_url
    assert PaymentOrder.objects.count() == 1
    # The replay must not open a second Stripe session.
    assert len(gateway.created) == 1


@pytest.mark.django_db
def test_reusing_an_idempotency_key_for_a_different_request_is_refused(seller, gateway):
    listing_right_product()
    create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        return_url="/sell/",
        client_idempotency_key="idem-1",
        gateway=gateway,
    )

    with pytest.raises(Exception) as excinfo:
        create_checkout_session(
            user=seller,
            product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            return_url="/dashboard/private-seller/",
            client_idempotency_key="idem-1",
            gateway=gateway,
        )

    assert excinfo.value.get_codes() == "idempotency_key_reused"


@pytest.mark.django_db
def test_starting_the_same_purchase_again_returns_the_open_session(seller, gateway):
    """The buyer backs out of Stripe's page and clicks Buy again: same order,
    same session, no second row in Purchases."""
    listing_right_product()
    first = create_checkout_session(
        user=seller, product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="click-1", gateway=gateway,
    )
    again = create_checkout_session(
        user=seller, product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="click-2", gateway=gateway,
    )

    assert again.created is False
    assert again.order.pk == first.order.pk
    assert again.checkout_url == first.checkout_url
    assert len(gateway.created) == 1
    assert PaymentOrder.objects.filter(user=seller).count() == 1


@pytest.mark.django_db
def test_a_different_purchase_gets_its_own_session(seller, gateway):
    listing_right_product()
    create_checkout_session(
        user=seller, product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="click-1", gateway=gateway,
    )
    other = create_checkout_session(
        user=seller, product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT, quantity=2,
        client_idempotency_key="click-2", gateway=gateway,
    )

    assert other.created is True
    assert len(gateway.created) == 2


@pytest.mark.django_db
def test_cancelling_an_open_checkout_expires_it_at_stripe_and_here(seller, gateway):
    listing_right_product()
    result = create_checkout_session(
        user=seller, product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="click-1", gateway=gateway,
    )

    order = cancel_checkout_session(user=seller, order_id=result.order.pk, gateway=gateway)

    assert order.status == PaymentOrderStatus.EXPIRED
    assert gateway.expired == [result.order.stripe_checkout_session_id]
    assert AuditEvent.objects.filter(action="payment_order.cancelled", target_id=str(order.pk)).exists()
    # A fresh click after the cancel opens a new session rather than the dead one.
    fresh = create_checkout_session(
        user=seller, product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="click-2", gateway=gateway,
    )
    assert fresh.created is True


@pytest.mark.django_db
def test_only_an_open_checkout_can_be_cancelled(seller, gateway):
    listing_right_product()
    result = create_checkout_session(
        user=seller, product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="click-1", gateway=gateway,
    )
    PaymentOrder.objects.filter(pk=result.order.pk).update(status=PaymentOrderStatus.EXPIRED)

    with pytest.raises(CheckoutNotOpen):
        cancel_checkout_session(user=seller, order_id=result.order.pk, gateway=gateway)
    assert gateway.expired == []


@pytest.mark.django_db
def test_two_users_may_use_the_same_idempotency_key(gateway):
    listing_right_product()
    first = make_payments_seller("p14-two-a@example.com")
    second = make_payments_seller("p14-two-b@example.com")
    kwargs = dict(
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="idem-shared",
        gateway=gateway,
    )

    a = create_checkout_session(user=first, **kwargs)
    b = create_checkout_session(user=second, **kwargs)

    assert a.order.pk != b.order.pk


@pytest.mark.django_db
def test_a_stripe_failure_leaves_a_retriable_created_order(seller):
    """The order is written before the Stripe call, so a transport failure must
    leave it recoverable rather than orphaned — and the retry must reuse the
    SAME Stripe idempotency key so a session Stripe did in fact create is
    returned rather than duplicated."""
    listing_right_product()
    failing = FakeStripeGateway(raise_on_create=StripeUnavailable("down"))

    with pytest.raises(PaymentGatewayUnavailable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            client_idempotency_key="idem-1",
            gateway=failing,
        )

    order = PaymentOrder.objects.get()
    assert order.status == PaymentOrderStatus.CREATED
    assert order.stripe_checkout_session_id == ""

    working = FakeStripeGateway()
    retry = create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="idem-1",
        gateway=working,
    )

    assert retry.order.pk == order.pk
    assert working.created[0]["idempotency_key"] == f"checkout:{order.pk}"
    assert PaymentOrder.objects.count() == 1


@pytest.mark.django_db
def test_a_media_upgrade_without_a_listing_is_refused(seller, gateway):
    media_upgrade_product()

    with pytest.raises(ListingRequiredForProduct):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.LISTING_MEDIA_UPGRADE,
            client_idempotency_key="idem-1",
            gateway=upgrade_gateway(),
        )


@pytest.mark.django_db
def test_a_listing_right_with_a_listing_id_is_refused(seller, gateway):
    """The inverse. A listing right is consumed at submit (spec §6.3), not bound
    at purchase, so accepting a listing id would create a binding the rest of
    the system does not honour."""
    listing_right_product()
    listing = make_private_listing(owner=seller)

    with pytest.raises(ListingNotUpgradable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            listing_id=str(listing.pk),
            client_idempotency_key="idem-1",
            gateway=gateway,
        )


@pytest.mark.django_db
def test_a_user_cannot_buy_a_media_upgrade_for_someone_elses_listing():
    """Spec §23's acceptance list: "User cannot buy a media upgrade for another
    user's listing." Also spec §33.1's IDOR rule."""
    media_upgrade_product()
    owner = make_payments_seller("p14-owner@example.com")
    attacker = make_payments_seller("p14-attacker@example.com")
    listing = make_private_listing(owner=owner)

    with pytest.raises(ListingNotUpgradable) as excinfo:
        create_checkout_session(
            user=attacker,
            product_code=ProductCode.LISTING_MEDIA_UPGRADE,
            listing_id=str(listing.pk),
            client_idempotency_key="idem-1",
            gateway=upgrade_gateway(),
        )

    assert excinfo.value.get_codes() == "listing_not_upgradable"
    assert PaymentOrder.objects.count() == 0


@pytest.mark.django_db
def test_an_unknown_listing_id_is_refused_the_same_way(seller):
    """A missing listing and someone else's listing must be indistinguishable,
    or the endpoint becomes a listing-ownership oracle."""
    media_upgrade_product()

    with pytest.raises(ListingNotUpgradable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.LISTING_MEDIA_UPGRADE,
            listing_id="8bd0a6d4-0000-4000-8000-000000000000",
            client_idempotency_key="idem-1",
            gateway=upgrade_gateway(),
        )


@pytest.mark.django_db
def test_an_already_upgraded_listing_cannot_be_upgraded_again(seller):
    """Spec §23.1: one upgrade, "bound to one eligible private-seller listing"."""
    media_upgrade_product()
    listing = make_private_listing(owner=seller)
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
        listing=listing,
        state=EntitlementState.AVAILABLE,
    )

    with pytest.raises(ListingNotUpgradable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.LISTING_MEDIA_UPGRADE,
            listing_id=str(listing.pk),
            client_idempotency_key="idem-1",
            gateway=upgrade_gateway(),
        )


@pytest.mark.django_db
def test_a_revoked_upgrade_does_not_block_a_new_purchase(seller):
    """A refunded upgrade is REVOKED (spec §23.4), and a REVOKED row is excluded
    from Phase 13's live-right unique index — so the customer may buy again."""
    media_upgrade_product()
    listing = make_private_listing(owner=seller)
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
        listing=listing,
        state=EntitlementState.REVOKED,
    )

    result = create_checkout_session(
        user=seller,
        product_code=ProductCode.LISTING_MEDIA_UPGRADE,
        listing_id=str(listing.pk),
        client_idempotency_key="idem-1",
        gateway=upgrade_gateway(),
    )

    assert result.order.listing_id == listing.pk


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status", [ListingStatus.ARCHIVED, ListingStatus.EXPIRED]
)
def test_an_archived_or_expired_listing_cannot_be_upgraded(seller, status):
    """Selling an upgrade for a listing that can never be published again would
    be selling nothing — and reactivation after expiry does not exist (Phase 13
    Known Limitation 4)."""
    media_upgrade_product()
    listing = make_private_listing(owner=seller, status=status)

    with pytest.raises(ListingNotUpgradable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.LISTING_MEDIA_UPGRADE,
            listing_id=str(listing.pk),
            client_idempotency_key="idem-1",
            gateway=upgrade_gateway(),
        )


@pytest.mark.django_db
def test_a_broker_listing_cannot_be_upgraded(seller):
    """Spec §23.1: the upgrade is bound to a "private-seller listing". Brokers
    already have the higher allowance (spec §24.1)."""
    from brokers.tests.factories import make_broker
    from listings.tests.factories import make_broker_listing

    media_upgrade_product()
    broker = make_broker("P14 Marine", "p14-marine")
    listing = make_broker_listing(broker=broker, actor=seller)

    with pytest.raises(ListingNotUpgradable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.LISTING_MEDIA_UPGRADE,
            listing_id=str(listing.pk),
            client_idempotency_key="idem-1",
            gateway=upgrade_gateway(),
        )


@pytest.mark.django_db
def test_checkout_creation_writes_two_audit_events(seller, gateway):
    """Spec §2.4: every state change is audited. CREATED and CHECKOUT_OPEN are
    two distinct states and each gets its own row, so an order stuck at CREATED
    is visibly distinguishable from one that never existed."""
    listing_right_product()

    result = create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="idem-1",
        gateway=gateway,
        request_id="req-42",
    )

    actions = list(
        AuditEvent.objects.filter(target_id=str(result.order.pk))
        .order_by("created_at")
        .values_list("action", flat=True)
    )
    assert actions == ["payment_order.created", "payment_order.checkout_opened"]
    event = AuditEvent.objects.get(action="payment_order.checkout_opened")
    assert event.actor_user_id == seller.pk
    assert event.source == AuditEvent.Source.API
    assert event.request_id == "req-42"


@pytest.mark.django_db
def test_no_secret_or_url_token_reaches_an_audit_event(seller, gateway, settings):
    settings.STRIPE_SECRET_KEY = "sk_live_NEVER_LOG_ME"
    listing_right_product()

    create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="idem-1",
        gateway=gateway,
    )

    dumped = "".join(
        str(event.metadata) + str(event.after) + str(event.before)
        for event in AuditEvent.objects.all()
    )
    assert "sk_live_NEVER_LOG_ME" not in dumped


@pytest.mark.django_db
def test_several_listing_rights_can_be_bought_in_one_checkout(seller, gateway):
    listing_right_product()

    result = create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        quantity=3,
        client_idempotency_key="idem-q",
        gateway=gateway,
    )

    assert result.order.quantity == 3
    assert result.order.amount == Decimal("147.00")
    params = gateway.created[0]["params"]
    assert params["line_items"][0]["quantity"] == 3
    assert params["metadata"]["quantity"] == "3"


def _package(**overrides):
    from payments.models import ListingPackage

    package = ListingPackage.objects.get(slug="2-months")
    values = {
        "display_amount": Decimal("79.00"),
        "stripe_product_id": "prod_pkg",
        "stripe_price_id": "price_pkg",
        "image_limit": 15,
        "video_limit": 2,
        "is_active": True,
    }
    values.update(overrides)
    for key, value in values.items():
        setattr(package, key, value)
    package.save()
    return package


def _package_gateway():
    return FakeStripeGateway(
        price=PriceSnapshot(
            price_id="price_pkg", product_id="prod_pkg", unit_amount=7900,
            currency="eur", active=True, recurring=False,
        )
    )


@pytest.mark.django_db
def test_a_package_checkout_uses_the_package_price_and_ids(seller):
    _package()
    gateway = _package_gateway()

    result = create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        package_slug="2-months",
        quantity=2,
        client_idempotency_key="idem-pkg",
        gateway=gateway,
    )

    assert result.order.package.slug == "2-months"
    assert result.order.amount == Decimal("158.00")
    params = gateway.created[0]["params"]
    assert params["line_items"] == [{"price": "price_pkg", "quantity": 2}]
    assert params["metadata"]["package"] == "2-months"


@pytest.mark.django_db
def test_an_inactive_package_cannot_be_bought(seller):
    with pytest.raises(ProductNotAvailable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            package_slug="1-month",
            client_idempotency_key="idem-x",
            gateway=_package_gateway(),
        )

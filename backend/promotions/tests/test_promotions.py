from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.enums import ListingStatus
from listings.tests.factories import make_media, make_private_listing, make_snapshot
from payments.enums import WebhookResult
from payments.tests.fakes import FakeStripeGateway
from promotions.checkout import handle_checkout
from promotions.models import ListingPromotion, PromotionPlan
from promotions.services import start_waiting

pytestmark = pytest.mark.django_db


@pytest.fixture
def seller():
    return make_user("seller@promo.example", role=UserRole.PRIVATE_SELLER, verified=True)


@pytest.fixture
def fake(monkeypatch):
    gateway = FakeStripeGateway()
    monkeypatch.setattr("payments.gateway.default_gateway", lambda: gateway)
    return gateway


def _api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def _buy(user, listing, plan="week"):
    response = _api(user).post(reverse("promotion-checkout"), {"listing_id": str(listing.pk), "plan": plan}, format="json")
    assert response.status_code == 201, response.content
    return ListingPromotion.objects.filter(listing=listing).order_by("-created_at").first()


def _paid_session(promotion, amount=None):
    return {
        "metadata": {"kind": "listing_promotion", "promotion_id": str(promotion.pk)},
        "payment_status": "paid",
        "amount_total": amount if amount is not None else int(promotion.amount * 100),
        "currency": "eur",
        "payment_intent": "pi_1",
    }


def _publish(listing):
    staff = make_user(f"mod-{listing.pk}@promo.example", role=UserRole.STAFF, verified=True)
    snapshot = make_snapshot(listing, approved_by=staff)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save()


def test_default_plans_are_public_and_editable_in_the_database():
    body = APIClient().get(reverse("promotion-plans")).json()
    assert [(p["code"], p["days"], p["price"]) for p in body] == [("week", 7, "99.00"), ("two-weeks", 14, "149.00"), ("month", 30, "199.00")]
    PromotionPlan.objects.filter(code="week").update(price="12.50")
    assert APIClient().get(reverse("promotion-plans")).json()[0]["price"] == "12.50"


def test_checkout_sends_the_plan_price_and_binds_the_listing(seller, fake):
    listing = make_private_listing(owner=seller)
    promotion = _buy(seller, listing, "two-weeks")
    params = fake.created[0]["params"]
    assert params["line_items"][0]["price_data"]["unit_amount"] == 14900
    assert params["metadata"]["promotion_id"] == str(promotion.pk)
    assert (promotion.days, promotion.status) == (14, "PENDING")


def test_choosing_again_closes_the_earlier_checkout_and_cancel_closes_the_last(seller, fake):
    """Back out of Stripe, pick another plan: the first session is expired at
    Stripe and the row is CANCELED, so one payable link exists at a time. The
    cancel return closes the last one and says so."""
    listing = make_private_listing(owner=seller)
    first = _buy(seller, listing, "week")
    second = _buy(seller, listing, "two-weeks")
    first.refresh_from_db()
    assert (first.status, first.note) == ("CANCELED", "replaced by a new checkout")
    assert fake.expired == [first.stripe_checkout_session_id]
    assert fake.created[1]["params"]["cancel_url"].endswith(f"?promotion=cancelled&listing={listing.pk}")

    response = _api(seller).post(reverse("promotion-cancel"), {"listing_id": str(listing.pk)}, format="json")
    assert response.status_code == 200
    assert response.json() == {"cancelled": 1}
    second.refresh_from_db()
    assert second.status == "CANCELED"
    assert fake.expired[-1] == second.stripe_checkout_session_id
    # Paid rows are never touched by a cancel.
    assert _api(seller).post(reverse("promotion-cancel"), {"listing_id": str(listing.pk)}, format="json").json() == {"cancelled": 0}


def test_a_stranger_cannot_cancel_someone_elses_promotion(seller, fake):
    listing = make_private_listing(owner=seller)
    _buy(seller, listing)
    stranger = make_user("stranger@promo.example", role=UserRole.PRIVATE_SELLER, verified=True)
    assert _api(stranger).post(reverse("promotion-cancel"), {"listing_id": str(listing.pk)}, format="json").status_code == 404
    assert fake.expired == []


def test_someone_elses_listing_and_unverified_users_are_refused(seller, fake):
    listing = make_private_listing(owner=seller)
    other = make_user("other@promo.example", role=UserRole.PRIVATE_SELLER, verified=True)
    body = {"listing_id": str(listing.pk), "plan": "week"}
    assert _api(other).post(reverse("promotion-checkout"), body, format="json").status_code == 404
    unverified = make_user("new@promo.example", role=UserRole.PRIVATE_SELLER, verified=False)
    assert _api(unverified).post(reverse("promotion-checkout"), body, format="json").status_code == 403
    assert not fake.created


def test_payment_before_publication_waits_and_starts_when_the_listing_goes_live(seller, fake):
    listing = make_private_listing(owner=seller)
    promotion = _buy(seller, listing)
    assert handle_checkout(_paid_session(promotion)) == WebhookResult.FULFILLED
    promotion.refresh_from_db()
    listing.refresh_from_db()
    assert promotion.status == "PAID" and promotion.starts_at is None and listing.featured_until is None
    assert handle_checkout(_paid_session(promotion)) == WebhookResult.ALREADY_FULFILLED

    _publish(listing)
    assert start_waiting(listing) == 1
    listing.refresh_from_db()
    assert timedelta(days=6, hours=23) < listing.featured_until - timezone.now() <= timedelta(days=7)


def test_a_second_purchase_stacks_after_the_running_one(seller, fake):
    listing = make_private_listing(owner=seller)
    _publish(listing)
    first = _buy(seller, listing, "week")
    handle_checkout(_paid_session(first))
    second = _buy(seller, listing, "week")
    handle_checkout(_paid_session(second))
    listing.refresh_from_db()
    assert timedelta(days=13, hours=23) < listing.featured_until - timezone.now() <= timedelta(days=14)


def test_a_wrong_amount_is_held_for_staff_and_never_features_the_listing(seller, fake):
    listing = make_private_listing(owner=seller)
    _publish(listing)
    promotion = _buy(seller, listing)
    assert handle_checkout(_paid_session(promotion, amount=1)) == WebhookResult.MISMATCH
    promotion.refresh_from_db()
    listing.refresh_from_db()
    assert promotion.status == "REVIEW" and listing.featured_until is None


def test_public_list_shows_only_running_promotions_newest_first(seller, fake):
    first, second, expired = (
        make_private_listing(owner=make_user(f"o{i}@promo.example", role=UserRole.PRIVATE_SELLER, verified=True)) for i in range(3)
    )
    now = timezone.now()
    for i, listing in enumerate((first, second, expired)):
        _publish(listing)
        make_media(listing)  # the featured strip only shows listings with a ready photo
        listing.featured_until = now + timedelta(days=3) if listing is not expired else now - timedelta(days=1)
        listing.featured_at = now + timedelta(minutes=i)
        listing.save()
    response = APIClient().get(reverse("listing-list"), {"featured": "1", "sort": "featured"}).json()
    assert [r["id"] for r in response["results"]] == [str(second.pk), str(first.pk)]
    assert all(r["is_featured"] for r in response["results"])


def test_featured_listings_lead_the_everyday_list(seller, fake):
    plain = make_private_listing(owner=make_user("p@promo.example", role=UserRole.PRIVATE_SELLER, verified=True))
    promoted = make_private_listing(owner=make_user("q@promo.example", role=UserRole.PRIVATE_SELLER, verified=True))
    _publish(promoted)
    _publish(plain)  # published later, so it would normally come first
    promoted.featured_until = timezone.now() + timedelta(days=2)
    promoted.featured_at = timezone.now()
    promoted.save()
    ids = [r["id"] for r in APIClient().get(reverse("listing-list")).json()["results"]]
    assert ids[0] == str(promoted.pk)


def test_the_return_path_may_be_the_listings_own_form(seller, fake):
    listing = make_private_listing(owner=seller)
    body = {"listing_id": str(listing.pk), "plan": "week", "return_path": f"/sell/{listing.pk}/"}
    assert _api(seller).post(reverse("promotion-checkout"), {**body}, format="json").status_code == 201
    assert _api(seller).post(reverse("promotion-checkout"), {**body, "return_path": "/evil/"}, format="json").status_code == 400


def test_a_professional_can_promote_the_profile_and_the_clock_starts_when_it_is_active(fake):
    from professionals.enums import ProfessionalProfileStatus
    from professionals.tests.factories import make_professional

    owner = make_user("pro@promo.example", role=UserRole.PROFESSIONAL, verified=True)
    profile = make_professional(owner)
    profile.status = ProfessionalProfileStatus.PENDING
    profile.save()
    response = _api(owner).post(reverse("promotion-checkout"), {"target": "profile", "plan": "month", "return_path": "/dashboard/service-provider/membership/"}, format="json")
    assert response.status_code == 201, response.content
    promotion = ListingPromotion.objects.get(professional=profile)
    assert handle_checkout(_paid_session(promotion)) == WebhookResult.FULFILLED
    profile.refresh_from_db()
    assert profile.featured_until is None  # not approved yet: the clock waits

    profile.status = ProfessionalProfileStatus.ACTIVE
    profile.save()  # staff approval
    profile.refresh_from_db()
    assert timedelta(days=29, hours=23) < profile.featured_until - timezone.now() <= timedelta(days=30)
    directory = APIClient().get(reverse("professional-directory")).json()
    assert directory["results"][0]["is_featured"] is True


def test_profile_promotion_needs_a_seat_that_can_edit_the_profile(fake):
    outsider = make_user("nobody@promo.example", role=UserRole.PRIVATE_SELLER, verified=True)
    response = _api(outsider).post(reverse("promotion-checkout"), {"target": "profile", "plan": "week"}, format="json")
    assert response.status_code == 403


def _feature(seller, fake):
    listing = make_private_listing(owner=seller)
    promotion = _buy(seller, listing)
    handle_checkout(_paid_session(promotion))
    _publish(listing)
    start_waiting(listing)
    return listing


def test_events_count_only_while_featured_and_reach_the_owner_report(seller, fake, monkeypatch):
    monkeypatch.setattr("listings.permissions.is_feature_enabled", lambda *a, **k: True)
    listing = _feature(seller, fake)
    other = make_private_listing(owner=seller, brand=listing.brand, model=listing.model)
    anon = APIClient()
    url = reverse("promotion-events")
    for kind in ("impression", "impression", "click"):
        assert anon.post(url, {"target": "listing", "id": str(listing.pk), "kind": kind}, format="json").status_code == 204
    anon.post(url, {"target": "listing", "id": str(other.pk), "kind": "impression"}, format="json")

    report = _api(seller).get(reverse("promotion-stats")).json()
    assert report["listings"] == {str(listing.pk): {"impressions": 2, "clicks": 1}}
    body = _api(seller).get(reverse("my-listings")).json()
    rows = {row["id"]: row for row in body}
    assert rows[str(listing.pk)]["promo_impressions"] == 2 and rows[str(listing.pk)]["promo_clicks"] == 1
    assert rows[str(other.pk)]["promo_impressions"] == 0


def test_events_after_the_promotion_ended_are_ignored(seller, fake):
    listing = _feature(seller, fake)
    listing.featured_until = timezone.now() - timedelta(minutes=1)
    listing.save(update_fields=["featured_until"])
    response = APIClient().post(reverse("promotion-events"), {"target": "listing", "id": str(listing.pk), "kind": "impression"}, format="json")
    assert response.status_code == 204
    assert _api(seller).get(reverse("promotion-stats")).json()["listings"] == {}

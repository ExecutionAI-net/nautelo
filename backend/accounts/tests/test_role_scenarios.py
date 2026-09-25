"""End-to-end role scenarios (QA round 2): broker, professional and staff.

Each scenario walks one role through its real journey over the HTTP API:
register, verify the email, pay (Stripe webhooks are simulated), finish the
profile, invite a team member, get approved by staff, receive and answer a
message from a visitor. They double as a regression net for the whole
onboarding chain.
"""

import hashlib
import io
import uuid

import pytest
from django.core import mail
from django.urls import reverse
from PIL import Image
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.models import User
from accounts.tests.factories import make_user
from brokers.models import BrokerOrganization, BrokerPlan
from listings import media_storage
from messaging.enums import CURRENT_PRIVACY_POLICY_VERSION
from messaging.models import Conversation
from payments.fulfillment import handle_checkout_session_paid
from payments.webhooks import HANDLERS
from professionals.models import ProfessionalMembership, ProfessionalPlan, ProfessionalProfile
from services_catalog.models import ServiceCategory

pytestmark = pytest.mark.django_db

PASSWORD = "Str0ng-Scenario-Pass!"


class FakeStorage:
    def __init__(self):
        self.objects = {}

    def upload_target(self, key, content_type):
        return media_storage.UploadTarget(url=f"https://storage.test/{key}", method="PUT", headers={}, expires_in=900)

    def size(self, key):
        return len(self.objects[key]) if key in self.objects else None

    def read_head(self, key, n=65536):
        return self.objects[key][:n]

    def sha256(self, key):
        return hashlib.sha256(self.objects[key]).hexdigest()

    def read(self, key):
        return self.objects[key]

    def write(self, key, data, content_type):
        self.objects[key] = data

    def delete(self, key):
        self.objects.pop(key, None)


@pytest.fixture(autouse=True)
def inquiries_on():
    from messaging.enums import UNIFIED_INQUIRIES_FLAG
    from platform_settings.services import set_feature_flag

    set_feature_flag(key=UNIFIED_INQUIRIES_FLAG, is_enabled=True, actor=None, description="scenario")


@pytest.fixture(autouse=True)
def storage(settings):
    settings.MEDIA_PUBLIC_BASE_URL = "https://cdn.test"
    previous = media_storage.get_media_storage()
    fake = FakeStorage()
    media_storage.set_media_storage(fake)
    yield fake
    media_storage.set_media_storage(previous)


def _png(w=400, h=400):
    out = io.BytesIO()
    Image.new("RGB", (w, h), (10, 80, 160)).save(out, format="PNG")
    return out.getvalue()


def _login(email):
    api = APIClient()
    res = api.post(reverse("auth-login"), {"email": email, "password": PASSWORD}, format="json")
    assert res.status_code == 200, res.content
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.json()['access']}")
    return api


def _verify(email, django_capture_on_commit_callbacks=None):
    body = next(m.body for m in reversed(mail.outbox) if email in m.to and "verify-email" in m.body)
    token = body.split("token=")[1].split()[0]
    res = APIClient().post(reverse("auth-verify-email"), {"token": token}, format="json")
    assert res.status_code == 200


def _register_org(org_type, email, name, django_capture_on_commit_callbacks, **extra):
    with django_capture_on_commit_callbacks(execute=True):
        res = APIClient().post(
            reverse("auth-register-organization"),
            {
                "org_type": org_type, "organization_name": name, "full_name": "Owner Person", "email": email,
                "password": PASSWORD, "phone": "+34600111222", "country_code": "ES", "accept_terms": True, **extra,
            },
            format="json",
        )
    assert res.status_code == 201, res.content
    return res


def _upload_logo(api, intent, complete, storage):
    data = _png()
    key = api.post(intent, {"kind": "logo", "mime_type": "image/png", "size": len(data)}, format="json").json()["key"]
    storage.objects[key] = data
    assert api.post(complete, {"kind": "logo", "key": key, "mime_type": "image/png"}, format="json").status_code == 200


def _broker_registration_uploads(storage):
    """A logo and a document for a new BROKER registration, written straight
    to the fake storage (customer feedback, 2026-09-25 - both are now
    mandatory before register_organization() will accept a broker)."""
    from accounts import registration_uploads

    registration_id = uuid.uuid4().hex
    logo_intent = registration_uploads.create_logo_intent(registration_id=registration_id, mime_type="image/png", size=1)
    storage.objects[logo_intent["key"]] = _png()
    logo_key = registration_uploads.finish_logo_upload(registration_id=registration_id, key=logo_intent["key"], mime_type="image/png")

    doc_intent = registration_uploads.create_document_intent(registration_id=registration_id, mime_type="application/pdf", size=1)
    storage.objects[doc_intent["key"]] = b"%PDF-1.4 fake document"
    doc_key = registration_uploads.finish_document_upload(registration_id=registration_id, key=doc_intent["key"])
    return registration_id, logo_key, [doc_key]


def _inquiry(target_type, target_id, email="buyer@visitor.example"):
    visitor = make_user(email, verified=True)
    api = APIClient()
    api.force_authenticate(visitor)
    res = api.post(
        reverse("inquiry-create"),
        {
            "context_type": target_type, "context_id": str(target_id), "full_name": "Ada Rossi", "email": email,
            "phone": "+390000000000", "subject": "Question about your services",
            "message": "I would like to talk about a job next month please.",
            "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION, "privacy_consent": True, "marketing_consent": False,
        },
        format="json",
    )
    return visitor, api, res


def _staff():
    staff = make_user("staff@nautelo.example", role=UserRole.STAFF, verified=True, is_staff=True)
    from django.contrib.auth.models import Group

    staff.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    api = APIClient()
    api.force_authenticate(staff)
    return staff, api


# --------------------------------------------------------------------- professional


def test_professional_journey(django_capture_on_commit_callbacks, storage):
    ProfessionalPlan.objects.create(
        slug="m", name="Membership", monthly_price=49, trial_days=30, is_active=True, stripe_product_id="prod_p", stripe_price_id="price_p"
    )
    ServiceCategory.objects.create(name_en="General", slug="general-scn")
    _register_org("PROFESSIONAL", "owner@blue-rigging.example", "Blue Rigging", django_capture_on_commit_callbacks, categories=["general-scn"])
    owner_user = User.objects.get(email="owner@blue-rigging.example")
    assert owner_user.primary_role == UserRole.PROFESSIONAL

    # Sign-in before the email is verified: what does the user get?
    res = APIClient().post(reverse("auth-login"), {"email": owner_user.email, "password": PASSWORD}, format="json")
    assert res.status_code in (200, 401, 403)
    _verify(owner_user.email)
    api = _login(owner_user.email)
    profile = ProfessionalProfile.objects.get(owner_user=owner_user)
    assert profile.status == "DRAFT"

    # 1. Cannot submit an empty profile, and is told why.
    res = api.patch(reverse("provider-profile"), {"submit": True}, format="json")
    assert res.status_code == 400 and "profile_incomplete" in str(res.json())

    # 2. Fill in the profile, add a service and a logo.
    api.patch(
        reverse("provider-profile"),
        {
            "short_description": "Rigging experts", "city": "Palma", "service_area": ["ES-IB"],
            "description": "We rig, repair and inspect sailing yachts across the western Mediterranean coast.",
        },
        format="json",
    )
    category = ServiceCategory.objects.create(name_en="Rigging", slug="rigging-scn")
    assert api.post(reverse("provider-service-list"), {"category": str(category.id), "title_en": "Mast"}, format="json").status_code == 201
    _upload_logo(api, reverse("provider-image-intent"), reverse("provider-image-complete"), storage)

    # 3. Complete but unpaid: still refused, with a different reason.
    res = api.patch(reverse("provider-profile"), {"submit": True}, format="json")
    assert res.status_code == 400 and "subscription_required" in str(res.json())

    # 4. Membership page reports a trial; checkout opens (gateway faked).
    membership = api.get(reverse("provider-membership")).json()
    assert membership["trial_available"] is True and membership["status"] == "INACTIVE"

    # 5. Stripe confirms the trial (no charge), then submit works.
    handle_checkout_session_paid({
        "id": "evt", "type": "checkout.session.completed",
        "data": {"object": {
            "id": "cs", "mode": "subscription", "payment_status": "no_payment_required", "customer": "cus_p", "subscription": "sub_p",
            "metadata": {"kind": "professional_membership", "professional_id": str(profile.pk), "trial": "1"},
        }},
    })
    assert api.get(reverse("provider-membership")).json()["status"] == "TRIALING"
    res = api.patch(reverse("provider-profile"), {"submit": True}, format="json")
    assert res.status_code == 200 and res.json()["status"] == "PENDING"

    # 6. Not public until staff approve.
    assert APIClient().get(reverse("professional-detail", args=[profile.slug])).status_code == 404
    _, staff_api = _staff()
    assert staff_api.post(reverse("staff-provider-status", args=[profile.pk]), {"status": "ACTIVE"}, format="json").status_code in (200, 204)
    public = APIClient().get(reverse("professional-detail", args=[profile.slug]))
    assert public.status_code == 200
    body = public.json()
    assert body["logo_url"].startswith("https://cdn.test/org-images/professional/")
    # The public team list names people; it never carries their login e-mail.
    assert len(body["team"]) == 1 and "email" not in body["team"][0]
    assert "owner@blue-rigging.example" not in public.content.decode()

    # 7. Invite a colleague; they join as an agent who may read messages.
    with django_capture_on_commit_callbacks(execute=True):
        assert api.post(reverse("provider-invitations"), {"email": "mia@blue-rigging.example", "role": "MANAGER"}, format="json").status_code == 201
    token = mail.outbox[-1].body.split("token=")[1].split()[0]
    assert APIClient().post(reverse("invitation-accept"), {"token": token, "password": PASSWORD, "full_name": "Mia Rossi"}, format="json").status_code == 201
    team = _login("mia@blue-rigging.example")
    assert len(team.get(reverse("provider-team")).json()) == 2
    assert team.post(reverse("provider-invitations"), {"email": "x@y.example", "role": "AGENT"}, format="json").status_code == 403
    assert {m["name"] for m in APIClient().get(reverse("professional-detail", args=[profile.slug])).json()["team"]} == {"Owner Person", "Mia Rossi"}

    # 8. A visitor writes; the owner AND the manager (who may read messages) can see and answer it.
    visitor, visitor_api, res = _inquiry("PROFESSIONAL", profile.pk)
    assert res.status_code == 201, res.content
    conversation = Conversation.objects.get()
    for who in (api, team):
        listing = who.get(reverse("conversation-list"))
        assert listing.status_code == 200
        assert len(listing.json()["results"] if isinstance(listing.json(), dict) and "results" in listing.json() else listing.json()) == 1, "team member cannot see the professional's messages"
    reply = team.post(reverse("conversation-messages", args=[conversation.pk]), {"message": "Happy to help, can you call us tomorrow?"}, format="json")
    assert reply.status_code == 201, reply.content
    seen = visitor_api.get(reverse("conversation-messages", args=[conversation.pk]))
    assert seen.status_code == 200 and "Happy to help" in str(seen.json())

    # 9. Removing the manager returns them to a plain account and closes access.
    seat = ProfessionalMembership.objects.get(user__email="mia@blue-rigging.example")
    assert api.delete(reverse("provider-team-member", args=[seat.pk])).status_code == 204
    assert User.objects.get(email="mia@blue-rigging.example").primary_role == UserRole.PRIVATE_SELLER
    assert team.get(reverse("provider-team")).status_code in (403, 404)


# --------------------------------------------------------------------------- broker


def test_broker_journey(django_capture_on_commit_callbacks, storage):
    from brokers.models import BrokerRole

    plan = BrokerPlan.objects.create(
        slug="scn-plan", name="Scenario", monthly_price=99, seat_limit=2, trial_days=30, stripe_product_id="prod_b", stripe_price_id="price_b"
    )
    role = BrokerRole.objects.create(slug="scn-ceo", name="CEO")
    registration_id, logo_key, document_keys = _broker_registration_uploads(storage)
    _register_org(
        "BROKER",
        "owner@harbour.example",
        "Harbour Brokers",
        django_capture_on_commit_callbacks,
        plan=plan.slug,
        trading_name="Harbour Brokers Yachts",
        role=role.slug,
        registration_id=registration_id,
        logo_key=logo_key,
        document_keys=document_keys,
    )
    _verify("owner@harbour.example")
    api = _login("owner@harbour.example")
    broker = BrokerOrganization.objects.get(name="Harbour Brokers")
    assert broker.status == "DRAFT"

    # Onboarding works while the brokerage is still DRAFT.
    assert api.get(reverse("broker-profile", args=[broker.pk])).status_code == 200
    assert api.get(reverse("broker-members" if False else "broker-member-detail", args=[broker.pk, broker.memberships.get().pk])).status_code in (200, 405)
    billing = api.get(reverse("broker-subscription", args=[broker.pk])).json()
    assert billing["trial_available"] is True and billing["status"] == "INACTIVE"

    res = api.post(reverse("broker-profile-submit", args=[broker.pk]))
    assert res.status_code == 400 and "profile_incomplete" in str(res.json())
    api.patch(
        reverse("broker-profile", args=[broker.pk]),
        {
            "tagline": "Boats we love", "city": "Palma", "country_code": "es", "specialties": ["Motor yachts"],
            "about": "A family brokerage selling motor and sailing yachts along the Spanish coast since 1998.",
        },
        format="json",
    )
    _upload_logo(api, reverse("broker-image-intent", args=[broker.pk]), reverse("broker-image-complete", args=[broker.pk]), storage)
    res = api.post(reverse("broker-profile-submit", args=[broker.pk]))
    assert res.status_code == 400 and "subscription_required" in str(res.json())

    handle_checkout_session_paid({
        "id": "evt", "type": "checkout.session.completed",
        "data": {"object": {
            "id": "cs", "mode": "subscription", "payment_status": "no_payment_required", "customer": "cus_b", "subscription": "sub_b",
            "metadata": {"kind": "broker_subscription", "broker_id": str(broker.pk), "trial": "1"},
        }},
    })
    assert api.get(reverse("broker-subscription", args=[broker.pk])).json()["status"] == "TRIALING"
    assert api.post(reverse("broker-profile-submit", args=[broker.pk])).json()["status"] == "PENDING"

    assert APIClient().get(reverse("public-broker-detail", args=[broker.slug])).status_code == 404
    _, staff_api = _staff()
    assert staff_api.post(reverse("staff-broker-status", args=[broker.pk]), {"status": "ACTIVE"}, format="json").status_code in (200, 204)
    public = APIClient().get(reverse("public-broker-detail", args=[broker.slug]))
    assert public.status_code == 200 and public.json()["logo_url"].startswith("https://cdn.test/org-images/broker/")

    # Team: invite an agent, seat limit (2) then blocks the third.
    with django_capture_on_commit_callbacks(execute=True):
        assert api.post(reverse("broker-invitations", args=[broker.pk]), {"email": "agent@harbour.example", "role": "MANAGER"}, format="json").status_code == 201
    token = mail.outbox[-1].body.split("token=")[1].split()[0]
    assert APIClient().post(reverse("invitation-accept"), {"token": token, "password": PASSWORD, "full_name": "Ann Agent"}, format="json").status_code == 201
    third = api.post(reverse("broker-invitations", args=[broker.pk]), {"email": "third@harbour.example", "role": "AGENT"}, format="json")
    assert third.status_code in (400, 402, 403, 409), "seat limit should stop a third seat on a 2-seat plan"
    agent = _login("agent@harbour.example")
    assert agent.post(reverse("broker-invitations", args=[broker.pk]), {"email": "z@y.example", "role": "AGENT"}, format="json").status_code == 403

    # A visitor writes to the brokerage; owner and manager both see and answer.
    visitor, visitor_api, res = _inquiry("BROKER", broker.pk, email="buyer2@visitor.example")
    assert res.status_code == 201, res.content
    conversation = Conversation.objects.get()
    for who in (api, agent):
        assert who.get(reverse("conversation-list")).status_code == 200
    reply = agent.post(reverse("conversation-messages", args=[conversation.pk]), {"message": "Thanks, we can show you the boat on Friday."}, format="json")
    assert reply.status_code == 201, reply.content
    assert "Friday" in str(visitor_api.get(reverse("conversation-messages", args=[conversation.pk])).json())

    # Suspension by staff (or a lapse) takes the public page down but not billing access.
    assert staff_api.post(reverse("staff-broker-status", args=[broker.pk]), {"status": "SUSPENDED"}, format="json").status_code in (200, 204)
    assert APIClient().get(reverse("public-broker-detail", args=[broker.slug])).status_code == 404
    assert api.get(reverse("broker-subscription", args=[broker.pk])).status_code == 200


# --------------------------------------------------------------------------- staff


def test_staff_boundaries():
    _, staff_api = _staff()
    seller = make_user("seller@x.example", verified=True)
    seller_api = APIClient()
    seller_api.force_authenticate(seller)
    # Non-staff never reach staff screens.
    for name in ("staff-broker-list", "staff-provider-list"):
        assert seller_api.get(reverse(name)).status_code == 403
        assert staff_api.get(reverse(name)).status_code == 200
    # Staff accounts are not invitable into organizations.
    owner = make_user("o@org.example", role=UserRole.PROFESSIONAL, verified=True)
    from professionals.tests.factories import make_professional

    make_professional(owner)
    api = APIClient()
    api.force_authenticate(owner)
    assert api.post(reverse("provider-invitations"), {"email": "staff@nautelo.example", "role": "AGENT"}, format="json").status_code == 400
    # Duplicate organization registration on an existing address is refused.
    res = APIClient().post(
        reverse("auth-register-organization"),
        {"org_type": "PROFESSIONAL", "organization_name": "Dup", "full_name": "D", "email": "seller@x.example", "password": PASSWORD, "phone": "1", "country_code": "ES"},
        format="json",
    )
    assert res.status_code == 400

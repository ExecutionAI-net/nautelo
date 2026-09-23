import pytest
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from contactdesk.models import ContactRequest

pytestmark = pytest.mark.django_db

BODY = {"topic": "general", "name": "Mateo Alarcon", "email": "m@example.org", "message": "Hello there", "consent": True}


def _post(**over):
    return APIClient().post(reverse("contact-request"), {**BODY, **over}, format="json")


def test_a_valid_message_is_stored_and_gets_a_reference():
    response = _post()
    assert response.status_code == 201
    assert response.json()["reference"].startswith("NAU-")
    assert ContactRequest.objects.get().email == "m@example.org"


def test_consent_and_message_are_required():
    assert _post(consent=False).status_code == 400
    assert _post(message="").status_code == 400


def test_financing_study_needs_no_free_text_and_keeps_only_known_details():
    response = _post(topic="financing", message="", details={"price": "250000", "evil": "x"})
    assert response.status_code == 201
    assert ContactRequest.objects.get().details == {"price": "250000"}


def test_markup_is_refused_and_honeypot_stores_nothing():
    assert _post(name="<b>x</b>").status_code == 400
    assert _post(website="http://spam.example").status_code == 201
    assert ContactRequest.objects.count() == 0


def test_a_financing_study_stores_the_servers_own_calculation():
    sim = {"country": "ES", "product": "LOAN", "condition": "NEW", "use": "PRIVATE", "price": "180000", "down_percent": "20", "term_years": "10"}
    assert _post(topic="financing", message="", details=sim).status_code == 201
    calculated = ContactRequest.objects.get().details["calculated"]
    assert 1500 < float(calculated["monthly"]) < 1700
    assert calculated["financed"] == "144000.00"


def test_a_simulation_outside_the_rules_is_stored_without_a_calculation():
    sim = {"country": "ES", "product": "LOAN", "condition": "NEW", "use": "PRIVATE", "price": "5000", "down_percent": "20", "term_years": "10"}
    _post(topic="financing", message="", details=sim)
    assert "calculated" not in ContactRequest.objects.get().details



def test_the_team_mailbox_is_told_about_every_stored_form(settings, django_capture_on_commit_callbacks):
    settings.CONTACT_NOTIFY_EMAIL = "team@nautelo.example"
    # The announcement is queued on commit, which the test transaction never reaches on its own.
    with django_capture_on_commit_callbacks(execute=True):
        response = _post(phone="+39 392 0618739")
    assert response.status_code == 201
    assert len(mail.outbox) == 1
    sent = mail.outbox[0]
    assert sent.to == ["team@nautelo.example"]
    assert response.json()["reference"] in sent.subject
    assert "Mateo Alarcon" in sent.subject and "m@example.org" in sent.body and "+39 392 0618739" in sent.body
    assert "/dashboard/staff/contact-requests/" in sent.body
    # The honeypot stores nothing and sends nothing.
    with django_capture_on_commit_callbacks(execute=True):
        _post(website="http://spam.example")
    assert len(mail.outbox) == 1


def _staff_client():
    from django.contrib.auth.models import Group

    from accounts.enums import StaffGroup

    staff = make_user("desk@nautelo.example", role=UserRole.STAFF, verified=True)
    staff.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    client = APIClient()
    client.force_authenticate(staff)
    return client, staff


def test_staff_list_and_update_contact_requests_with_notes():
    _post()
    _post(topic="financing", message="", name="Ana Ruiz", email="ana@example.org", details={"price": "250000"})
    client, staff = _staff_client()
    body = client.get(reverse("staff-contact-request-list")).json()
    assert body["count"] == 2 and body["facets"] == {"NEW": 2}
    assert [row["name"] for row in body["results"]] == ["Ana Ruiz", "Mateo Alarcon"]
    assert body["results"][0]["details"] == {"price": "250000"} and body["results"][0]["topic_label"] == "Financing"
    assert client.get(reverse("staff-contact-request-list"), {"topic": "financing"}).json()["count"] == 1
    assert client.get(reverse("staff-contact-request-list"), {"q": "ruiz"}).json()["count"] == 1

    row_id = body["results"][1]["id"]
    updated = client.patch(
        reverse("staff-contact-request-update", args=[row_id]), {"status": "HANDLED", "notes": "Called back, sent the brochure."}, format="json"
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "HANDLED" and updated.json()["notes"] == "Called back, sent the brochure."
    assert updated.json()["handled_by_email"] == staff.email and updated.json()["handled_at"]
    assert client.get(reverse("staff-contact-request-list"), {"status": "HANDLED"}).json()["count"] == 1
    # Markup is refused in notes, like everywhere else.
    assert client.patch(reverse("staff-contact-request-update", args=[row_id]), {"notes": "<b>x</b>"}, format="json").status_code == 400


def test_only_staff_admins_see_the_contact_desk():
    _post()
    visitor = APIClient()
    assert visitor.get(reverse("staff-contact-request-list")).status_code == 401
    seller = make_user("seller@example.org", role=UserRole.PRIVATE_SELLER, verified=True)
    visitor.force_authenticate(seller)
    assert visitor.get(reverse("staff-contact-request-list")).status_code == 403

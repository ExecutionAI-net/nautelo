import pytest
from django.urls import reverse
from rest_framework.test import APIClient

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

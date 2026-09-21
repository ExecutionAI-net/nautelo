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

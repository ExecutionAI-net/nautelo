import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from accounts.tests.factories import make_user
from brokers.models import BrokerOrganization
from messaging.enums import ConversationType
from messaging.tests.factories import make_conversation, make_message
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


def _admin_client():
    user = get_user_model().objects.create_superuser(email="root@example.com", password="pw-12345-long")
    client = Client()
    client.force_login(user)
    return client


def test_admin_list_shows_the_recipient_and_filters_by_it():
    buyer = make_user("buyer@example.com", verified=True)
    broker = BrokerOrganization.objects.create(
        name="Acme Yachts", slug="acme", status="ACTIVE", public_email="a@example.com", public_phone="+34600000000"
    )
    professional = make_professional(make_user("pro@example.com", role="PROFESSIONAL"))
    to_broker = make_conversation(initiator=buyer, broker=broker)
    make_message(conversation=to_broker, sender=buyer)
    make_conversation(
        initiator=buyer, conversation_type=ConversationType.PROFESSIONAL_INQUIRY, professional=professional
    )
    client = _admin_client()
    url = reverse("admin:messaging_conversation_changelist")

    page = client.get(url)
    assert page.status_code == 200
    body = page.content.decode()
    assert "Broker: Acme Yachts" in body
    assert f"Professional: {professional.display_name}" in body

    filtered = client.get(url, {"broker__id__exact": str(broker.pk)})
    assert filtered.status_code == 200
    assert "Broker: Acme Yachts" in filtered.content.decode()
    assert f"Professional: {professional.display_name}" not in filtered.content.decode()

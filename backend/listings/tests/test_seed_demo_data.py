import pytest
from django.core.files.storage import InMemoryStorage
from django.core.management import call_command
from django.core.management.base import CommandError

from accounts.models import User
from listings.enums import ListingStatus
from listings.management.commands import seed_demo_data as command
from listings.models import BoatListing, ListingMedia
from messaging.models import Conversation
from professionals.models import ProfessionalProfile

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def memory_storage(monkeypatch):
    monkeypatch.setattr(command, "default_storage", InMemoryStorage())


def test_seed_builds_a_filterable_dataset_and_reset_removes_it(client):
    call_command("seed_demo_data", password="Demo-Test-12345!")

    published = BoatListing.objects.filter(status=ListingStatus.PUBLISHED)
    assert published.count() >= 70
    assert {ListingStatus.PENDING_APPROVAL, ListingStatus.DRAFT, ListingStatus.REJECTED, ListingStatus.SUSPENDED, ListingStatus.EXPIRED} <= set(
        BoatListing.objects.values_list("status", flat=True)
    )
    assert published.values("brand").distinct().count() >= 15
    assert ListingMedia.objects.count() >= 200
    assert ProfessionalProfile.objects.count() >= 12
    assert Conversation.objects.count() >= 30
    assert User.objects.get(email="admin@demo.nauta.test").check_password("Demo-Test-12345!")

    body = client.get("/api/v1/listings/", {"country": "IT", "brand": "Sunseeker"}).json()
    assert body["count"] >= 1
    assert all(row["brand_name"] == "Sunseeker" for row in body["results"])

    with pytest.raises(CommandError):
        call_command("seed_demo_data")

    call_command("seed_demo_data", reset_only=True)
    assert not User.objects.filter(email__endswith="@demo.nauta.test").exists()
    assert not BoatListing.objects.exists()

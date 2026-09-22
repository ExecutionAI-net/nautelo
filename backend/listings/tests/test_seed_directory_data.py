import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from accounts.models import User
from brokers.models import BrokerOrganization
from professionals.models import ProfessionalProfile

pytestmark = pytest.mark.django_db


def test_seed_builds_100_brokers_and_100_professionals_across_sectors_and_languages(client):
    call_command("seed_directory_data", password="Demo-Test-12345!")

    brokers = BrokerOrganization.objects.filter(slug__startswith="dd-")
    professionals = ProfessionalProfile.objects.filter(slug__startswith="dd-")
    assert brokers.count() == 100
    assert professionals.count() == 100

    # Different sectors: every service category has at least one professional.
    categories = set(professionals.values_list("services__category__slug", flat=True))
    assert categories == {"legal", "insurance", "engines-maintenance", "transport-delivery", "nautical-marketing", "full-brokerage"}

    # Different locations: more than a handful of countries on each side.
    assert brokers.values("country_code").distinct().count() >= 10
    assert professionals.values("country_code").distinct().count() >= 10

    # Different languages: every new account's locale spreads across all three the
    # site supports, not just one.
    dd_users = User.objects.filter(email__startswith="dd-")
    assert dd_users.count() == 200
    assert set(dd_users.values_list("locale", flat=True)) == {"EN", "IT", "ES"}
    assert dd_users.get(email="dd-broker1@demo.nauta.test").check_password("Demo-Test-12345!")

    # The public directory endpoints can actually find and filter this data.
    body = client.get("/api/v1/professionals/", {"category": "legal"}).json()
    assert body["count"] >= 1

    body = client.get("/api/v1/brokers/", {"country": "IT"}).json()
    assert body["count"] >= 1
    assert all(row["url"] for row in body["results"])

    # Running it twice refuses instead of duplicating the dataset.
    with pytest.raises(CommandError):
        call_command("seed_directory_data")

    # seed_demo_data's --reset-only removes this data too, since it shares the demo
    # domain (spec: one place to clean up every demo dataset).
    call_command("seed_demo_data", reset_only=True)
    assert not User.objects.filter(email__startswith="dd-").exists()
    assert not BrokerOrganization.objects.filter(slug__startswith="dd-").exists()
    assert not ProfessionalProfile.objects.filter(slug__startswith="dd-").exists()

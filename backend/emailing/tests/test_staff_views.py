import pytest
from django.contrib.auth.models import Group
from django.core import mail
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from emailing.models import EmailTemplate

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/staff/email-templates/"


def detail_url(key, locale):
    return f"/api/v1/staff/email-templates/{key}/{locale}/"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def staff_admin():
    admin = make_user("p17-email-admin@example.com", role=UserRole.STAFF, verified=True)
    admin.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    return admin


@pytest.fixture
def staff_moderator():
    mod = make_user("p17-email-mod@example.com", role=UserRole.STAFF, verified=True)
    mod.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    return mod


def test_an_anonymous_caller_cannot_list_templates(api):
    assert api.get(LIST_URL).status_code in (401, 403)


def test_a_staff_moderator_cannot_list_templates(api, staff_moderator):
    api.force_authenticate(staff_moderator)

    assert api.get(LIST_URL).status_code == 403


def test_the_list_shows_every_registered_key_across_all_three_locales(api, staff_admin):
    api.force_authenticate(staff_admin)

    response = api.get(LIST_URL)

    assert response.status_code == 200
    keys = {row["key"] for row in response.data["templates"]}
    assert "password_reset" in keys
    row = next(row for row in response.data["templates"] if row["key"] == "password_reset")
    assert set(row["locales"]) == {"EN", "IT", "ES"}
    # Seeded by emailing/migrations/0002.
    assert row["locales"]["EN"]["exists"] is True
    assert row["locales"]["IT"]["exists"] is False


def test_getting_a_missing_locale_returns_an_empty_draft_not_a_404(api, staff_admin):
    api.force_authenticate(staff_admin)

    response = api.get(detail_url("password_reset", "IT"))

    assert response.status_code == 200
    assert response.data["exists"] is False
    assert response.data["subject"] == ""
    assert response.data["html_body"] == ""
    assert response.data["variables"] == ["name", "url"]


def test_an_unknown_key_or_locale_404s(api, staff_admin):
    api.force_authenticate(staff_admin)

    assert api.get(detail_url("not_a_real_key", "EN")).status_code == 404
    assert api.get(detail_url("password_reset", "FR")).status_code == 404


def test_put_creates_a_new_locale_row_and_stamps_the_editor(api, staff_admin):
    api.force_authenticate(staff_admin)

    response = api.put(
        detail_url("password_reset", "IT"),
        {"subject": "Reimposta {{ name }}", "html_body": "<p>Ciao {{ name }}</p>"},
        format="json",
    )

    assert response.status_code == 200
    row = EmailTemplate.objects.get(key="password_reset", locale="IT")
    assert row.subject == "Reimposta {{ name }}"
    assert row.updated_by_id == staff_admin.pk


def test_put_updates_an_existing_row_in_place(api, staff_admin):
    EmailTemplate.objects.create(key="password_reset", locale="IT", subject="old", html_body="<p>old</p>")
    api.force_authenticate(staff_admin)

    api.put(detail_url("password_reset", "IT"), {"subject": "new", "html_body": "<p>new</p>"}, format="json")

    assert EmailTemplate.objects.filter(key="password_reset", locale="IT").count() == 1
    assert EmailTemplate.objects.get(key="password_reset", locale="IT").subject == "new"


def test_put_rejects_a_blank_subject_or_body(api, staff_admin):
    api.force_authenticate(staff_admin)

    response = api.put(detail_url("password_reset", "IT"), {"subject": "", "html_body": "<p>x</p>"}, format="json")

    assert response.status_code == 400
    assert not EmailTemplate.objects.filter(key="password_reset", locale="IT").exists()


def test_preview_substitutes_sample_data_and_does_not_touch_the_database(api, staff_admin):
    api.force_authenticate(staff_admin)

    response = api.post(
        f"{detail_url('password_reset', 'IT')}preview/",
        {"subject": "Reset for {{ name }}", "html_body": "<p>Go to {{ url }}</p>"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["subject"] == "Reset for Alex Morgan"
    assert "Go to " in response.data["html"]
    assert "Alex Morgan" not in response.data["html"]
    assert not EmailTemplate.objects.filter(key="password_reset", locale="IT").exists()


def test_test_send_emails_only_the_requesting_staffer(api, staff_admin):
    api.force_authenticate(staff_admin)

    response = api.post(
        f"{detail_url('password_reset', 'EN')}test-send/",
        {"subject": "Reset for {{ name }}", "html_body": "<p>Hi {{ name }}</p>"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["sent_to"] == staff_admin.email
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [staff_admin.email]
    assert "Alex Morgan" in mail.outbox[0].alternatives[0][0]

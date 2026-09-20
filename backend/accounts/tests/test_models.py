import uuid

import pytest
from django.db import IntegrityError, transaction

from accounts.enums import Locale, UserRole
from accounts.models import User
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user


@pytest.mark.django_db
def test_user_primary_key_is_a_uuid():
    user = make_user("uuid@example.com")
    assert isinstance(user.pk, uuid.UUID)


@pytest.mark.django_db
def test_create_user_normalizes_email_to_lowercase():
    user = User.objects.create_user(
        email="  MixedCase@Example.COM ", password=DEFAULT_TEST_PASSWORD
    )
    assert user.email == "mixedcase@example.com"


@pytest.mark.django_db
def test_email_uniqueness_is_case_insensitive_at_database_level():
    make_user("dupe@example.com")
    with pytest.raises(IntegrityError), transaction.atomic():
        # Bypasses save()/manager normalization on purpose: the DB must still refuse.
        User.objects.bulk_create([User(email="DUPE@example.com", password="x")])


@pytest.mark.django_db
def test_defaults_are_buyer_english_unverified_and_active():
    user = User.objects.create_user(
        email="defaults@example.com", password=DEFAULT_TEST_PASSWORD
    )
    assert user.primary_role == UserRole.PRIVATE_SELLER
    assert user.locale == Locale.EN
    assert user.email_verified_at is None
    assert user.is_email_verified is False
    assert user.is_active is True
    assert user.is_staff is False


@pytest.mark.django_db
def test_create_user_requires_an_email():
    with pytest.raises(ValueError):
        User.objects.create_user(email="", password=DEFAULT_TEST_PASSWORD)


@pytest.mark.django_db
def test_create_superuser_is_staff_superuser_staff_role_and_verified():
    user = User.objects.create_superuser(
        email="root@example.com", password=DEFAULT_TEST_PASSWORD
    )
    assert user.is_staff is True
    assert user.is_superuser is True
    assert user.primary_role == UserRole.STAFF
    assert user.is_email_verified is True


@pytest.mark.django_db
def test_password_is_hashed_not_stored_in_plain_text():
    user = make_user("hash@example.com")
    assert user.password != DEFAULT_TEST_PASSWORD
    assert user.check_password(DEFAULT_TEST_PASSWORD) is True


@pytest.mark.django_db
def test_get_full_name_falls_back_to_email():
    assert make_user("noname@example.com").get_full_name() == "noname@example.com"
    named = make_user("named@example.com", full_name="Ada Lovelace")
    assert named.get_full_name() == "Ada Lovelace"
    assert named.get_short_name() == "Ada"

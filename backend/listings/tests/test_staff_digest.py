import pytest
from django.contrib.auth.models import Group
from django.core import mail

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from listings.enums import ListingStatus
from listings.staff_digest import send_staff_digest
from listings.tests.factories import make_private_listing
from notifications.models import NotificationPreference

pytestmark = pytest.mark.django_db


def _moderator():
    user = make_user(role=UserRole.STAFF)
    user.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    return user


def test_nothing_is_sent_when_every_queue_is_empty():
    _moderator()
    assert send_staff_digest() == 0
    assert mail.outbox == []


def test_moderators_get_a_digest_unless_they_opted_out():
    kept, opted_out = _moderator(), _moderator()
    NotificationPreference.objects.create(user=opted_out, email_enabled=False)
    make_private_listing(
        owner=make_user(role=UserRole.PRIVATE_SELLER), status=ListingStatus.SUSPENDED
    )

    assert send_staff_digest() == 1
    assert [m.to for m in mail.outbox] == [[kept.email]]
    assert "Suspended listings: 1" in mail.outbox[0].body

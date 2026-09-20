import pytest
from django.contrib.admin.helpers import ACTION_CHECKBOX_NAME
from django.urls import reverse

from django.contrib.auth.models import Group

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from entitlements.models import UserEntitlement
from payments.models import ListingPackage


@pytest.mark.django_db
def test_gifting_a_package_carries_its_days_and_limits(client):
    admin_user = make_user("gift-admin@example.com", role=UserRole.STAFF, verified=True)
    admin_user.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.save()
    seller = make_user("gift-seller@example.com", role=UserRole.PRIVATE_SELLER, verified=True)
    package = ListingPackage.objects.get(slug="2-months")
    client.force_login(admin_user)

    response = client.post(
        reverse("admin:accounts_user_changelist"),
        {
            "action": "gift_paid_listing",
            ACTION_CHECKBOX_NAME: [str(seller.pk)],
            "apply_reason": "1",
            "package": str(package.pk),
            "reason": "Launch gift",
        },
    )

    assert response.status_code == 302
    right = UserEntitlement.objects.get(user=seller)
    assert right.metadata["package"] == "2-months"
    assert right.metadata["publication_days"] == 60
    assert right.metadata["reason"] == "Launch gift"

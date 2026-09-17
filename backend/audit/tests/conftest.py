import pytest
from django.contrib.auth import get_user_model


@pytest.fixture
def staff_user(db):
    User = get_user_model()
    return User.objects.create_user(
        username="staff-audit",
        email="staff-audit@nautelo.local",
        password="pw",
        is_staff=True,
    )

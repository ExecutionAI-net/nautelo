import hashlib
import io

import pytest
from django.urls import reverse
from PIL import Image
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker, make_membership
from listings import media_storage
from professionals.models import ProfessionalMembership
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


class FakeStorage:
    def __init__(self):
        self.objects = {}

    def upload_target(self, key, content_type):
        return media_storage.UploadTarget(url=f"https://storage.test/{key}", method="PUT", headers={"Content-Type": content_type}, expires_in=900)

    def size(self, key):
        return len(self.objects[key]) if key in self.objects else None

    def read_head(self, key, n=65536):
        return self.objects[key][:n]

    def sha256(self, key):
        return hashlib.sha256(self.objects[key]).hexdigest()

    def read(self, key):
        return self.objects[key]

    def write(self, key, data, content_type):
        self.objects[key] = data

    def delete(self, key):
        self.objects.pop(key, None)


@pytest.fixture(autouse=True)
def storage(settings):
    settings.MEDIA_PUBLIC_BASE_URL = "https://cdn.test"
    previous = media_storage.get_media_storage()
    fake = FakeStorage()
    media_storage.set_media_storage(fake)
    yield fake
    media_storage.set_media_storage(previous)


def _png(w, h):
    out = io.BytesIO()
    Image.new("RGB", (w, h), (10, 80, 160)).save(out, format="PNG")
    return out.getvalue()


def _upload(api, storage, intent_url, complete_url, *, kind="logo", data=None, mime="image/png"):
    data = data or _png(300, 300)
    intent = api.post(intent_url, {"kind": kind, "mime_type": mime, "size": len(data)}, format="json")
    assert intent.status_code == 201, intent.content
    key = intent.json()["key"]
    storage.objects[key] = data
    return key, api.post(complete_url, {"kind": kind, "key": key, "mime_type": mime}, format="json")


def _pro():
    owner = make_user("o@pro.example", role=UserRole.PROFESSIONAL, verified=True)
    profile = make_professional(owner)
    api = APIClient()
    api.force_authenticate(owner)
    return api, profile


def test_professional_uploads_a_logo_and_replaces_it(storage):
    api, profile = _pro()
    urls = (reverse("provider-image-intent"), reverse("provider-image-complete"))
    key, res = _upload(api, storage, *urls)
    assert res.status_code == 200
    assert res.json()["logo_url"] == f"https://cdn.test/{key}"
    profile.refresh_from_db()
    assert profile.logo_key == key
    key2, _ = _upload(api, storage, *urls)
    assert key not in storage.objects and key2 in storage.objects


def test_bad_uploads_are_refused_and_deleted(storage):
    api, _ = _pro()
    urls = (reverse("provider-image-intent"), reverse("provider-image-complete"))
    _, small = _upload(api, storage, *urls, data=_png(40, 40))
    assert small.status_code == 400 and "image_too_small" in str(small.json())
    _, junk = _upload(api, storage, *urls, data=b"not an image")
    assert junk.status_code == 400 and "unreadable_image" in str(junk.json())
    assert not storage.objects
    bad_type = api.post(urls[0], {"kind": "logo", "mime_type": "image/gif", "size": 10}, format="json")
    assert bad_type.status_code == 400
    too_big = api.post(urls[0], {"kind": "logo", "mime_type": "image/png", "size": 9 * 1024 * 1024}, format="json")
    assert too_big.status_code == 400


def test_a_key_from_another_organization_is_rejected(storage):
    api, _ = _pro()
    res = api.post(
        reverse("provider-image-complete"),
        {"kind": "logo", "key": "org-images/professional/someone-else/logo-x.png", "mime_type": "image/png"},
        format="json",
    )
    assert res.status_code == 400


def test_a_viewer_cannot_change_images():
    api, profile = _pro()
    viewer = make_user("v@pro.example", role=UserRole.PROFESSIONAL, verified=True)
    ProfessionalMembership.objects.create(user=viewer, profile=profile, role="VIEWER")
    client = APIClient()
    client.force_authenticate(viewer)
    assert client.post(reverse("provider-image-intent"), {"kind": "logo", "mime_type": "image/png", "size": 10}, format="json").status_code == 403


def test_broker_cover_upload_shows_on_the_public_page(storage):
    admin = make_user("a@br.example", role=UserRole.BROKER, verified=True)
    broker = make_broker()
    make_membership(admin, broker, role="ADMIN", can_edit_listings=True, can_manage_team=True, can_read_messages=True)
    api = APIClient()
    api.force_authenticate(admin)
    key, res = _upload(
        api, storage,
        reverse("broker-image-intent", args=[broker.pk]), reverse("broker-image-complete", args=[broker.pk]),
        kind="cover", data=_png(900, 400),
    )
    assert res.status_code == 200
    public = APIClient().get(reverse("public-broker-detail", args=[broker.slug])).json()
    assert public["cover_image_url"] == f"https://cdn.test/{key}"
    outsider = make_user("x@br.example", role=UserRole.BROKER, verified=True)
    other = APIClient()
    other.force_authenticate(outsider)
    assert other.post(reverse("broker-image-intent", args=[broker.pk]), {"kind": "logo", "mime_type": "image/png", "size": 1}, format="json").status_code == 403

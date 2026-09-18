import pytest
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from services_catalog.admin import ServiceCategoryAdmin
from services_catalog.models import ServiceCategory
from services_catalog.services import (
    category_audit_snapshot,
    delete_service_category,
    save_service_category,
)
from services_catalog.tests.factories import make_service_category


@pytest.fixture
def staff_user(db):
    return make_user("catalog-admin@example.com", role=UserRole.STAFF, is_staff=True)


@pytest.mark.django_db
def test_saving_a_new_category_records_a_created_event(staff_user):
    category = ServiceCategory(slug="test-insurance", name_en="Test Insurance")

    save_service_category(category=category, actor=staff_user)

    event = AuditEvent.objects.get(action="service_category.created")
    assert event.target_type == "services_catalog.ServiceCategory"
    assert event.target_id == str(category.pk)
    assert event.actor_user == staff_user
    assert event.source == AuditEvent.Source.ADMIN
    assert event.before is None
    assert event.after["slug"] == "test-insurance"


@pytest.mark.django_db
def test_updating_a_category_records_before_and_after(staff_user):
    category = make_service_category(slug="test-legal", name_en="Test Legal")
    category.name_en = "Legal services"
    category.is_active = False

    save_service_category(category=category, actor=staff_user)

    event = AuditEvent.objects.get(action="service_category.updated")
    assert event.before["name_en"] == "Test Legal"
    assert event.before["is_active"] is True
    assert event.after["name_en"] == "Legal services"
    assert event.after["is_active"] is False


@pytest.mark.django_db
def test_deleting_a_category_records_a_deleted_event(staff_user):
    category = make_service_category(slug="test-transport", name_en="Test Transport")
    pk = str(category.pk)

    delete_service_category(category=category, actor=staff_user)

    event = AuditEvent.objects.get(action="service_category.deleted")
    assert event.target_id == pk
    assert event.before["slug"] == "test-transport"
    assert event.after is None
    assert not ServiceCategory.objects.filter(pk=pk).exists()


@pytest.mark.django_db
def test_an_invalid_category_is_rejected_before_anything_is_written(staff_user):
    category = ServiceCategory(slug="professionals", name_en="Professionals")

    with pytest.raises(Exception):
        save_service_category(category=category, actor=staff_user)

    assert not ServiceCategory.objects.filter(slug="professionals").exists()
    assert not AuditEvent.objects.filter(action="service_category.created").exists()


@pytest.mark.django_db
def test_admin_save_model_delegates_to_the_audited_service(staff_user):
    admin = ServiceCategoryAdmin(ServiceCategory, AdminSite())
    request = RequestFactory().post("/admin/services_catalog/servicecategory/add/")
    request.user = staff_user
    category = ServiceCategory(slug="test-nautical", name_en="Test Nautical")

    admin.save_model(request, category, form=None, change=False)

    assert ServiceCategory.objects.filter(slug="test-nautical").exists()
    assert AuditEvent.objects.filter(action="service_category.created").count() == 1


@pytest.mark.django_db
def test_admin_delete_model_delegates_to_the_audited_service(staff_user):
    admin = ServiceCategoryAdmin(ServiceCategory, AdminSite())
    request = RequestFactory().post("/admin/services_catalog/servicecategory/1/delete/")
    request.user = staff_user
    category = make_service_category(slug="test-engines", name_en="Test Engines")

    admin.delete_model(request, category)

    assert not ServiceCategory.objects.filter(slug="test-engines").exists()
    assert AuditEvent.objects.filter(action="service_category.deleted").count() == 1


@pytest.mark.django_db
def test_audit_snapshot_covers_every_staff_editable_column():
    snapshot = category_audit_snapshot(make_service_category())

    for field in (
        "name_en", "name_it", "name_es", "slug",
        "description_en", "description_it", "description_es",
        "icon_key", "display_order", "is_active", "has_seo_page",
        "seo_title_en", "seo_title_it", "seo_title_es",
        "seo_description_en", "seo_description_it", "seo_description_es",
    ):
        assert field in snapshot

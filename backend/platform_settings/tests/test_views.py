import pytest


@pytest.mark.django_db
def test_public_settings_endpoint_returns_all_seeded_keys(client):
    response = client.get("/api/v1/platform/public-settings/")

    assert response.status_code == 200
    body = response.json()

    assert body["settings_version"] == 1
    assert "updated_at" in body
    assert body["settings"] == {
        "finance.enabled": True,
        "individual.free_listing_count": 1,
        "individual.free_period_days": 365,
        "individual.free_publish_days": 30,
        "individual.paid_publish_days": 30,
        "individual.paid_entitlement_valid_days": 365,
        "media.private_base_image_limit": 1,
        "media.private_base_video_limit": 0,
        "media.upgraded_image_limit": 20,
        "media.upgraded_video_limit": 1,
        "media.broker_image_limit": 20,
        "media.broker_video_limit": 1,
    }


@pytest.mark.django_db
def test_public_settings_endpoint_does_not_require_authentication(client):
    response = client.get("/api/v1/platform/public-settings/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_public_settings_endpoint_reflects_updates_after_commit(
    client, django_capture_on_commit_callbacks, staff_user
):
    from platform_settings.services import update_setting

    with django_capture_on_commit_callbacks(execute=True):
        update_setting(key="individual.free_listing_count", value=36, actor=staff_user)

    response = client.get("/api/v1/platform/public-settings/")

    assert response.json()["settings"]["individual.free_listing_count"] == 36
    assert response.json()["settings_version"] == 2


@pytest.mark.django_db
def test_get_public_settings_only_queries_the_database_once_per_cache_fill(
    django_assert_num_queries,
):
    from platform_settings.services import get_public_settings

    get_public_settings()  # first call warms the cache

    with django_assert_num_queries(0):
        get_public_settings()

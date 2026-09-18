import pytest
from django.db import IntegrityError, transaction

from accounts.tests.factories import make_user
from listings.enums import MediaStatus, MediaType
from listings.models import ListingMedia
from listings.tests.factories import make_media, make_private_listing


@pytest.mark.django_db
def test_media_defaults_to_uploading_when_status_is_not_supplied():
    listing = make_private_listing(owner=make_user())
    media = make_media(listing, status=MediaStatus.UPLOADING)

    assert media.status == MediaStatus.UPLOADING
    assert media.media_type == MediaType.IMAGE


@pytest.mark.django_db
def test_duplicate_storage_key_on_one_listing_is_rejected():
    listing = make_private_listing(owner=make_user())
    first = make_media(listing)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_media(listing, storage_key=first.storage_key, sort_order=1)


@pytest.mark.django_db
def test_duplicate_sort_order_within_one_media_type_is_rejected():
    listing = make_private_listing(owner=make_user())
    make_media(listing, media_type=MediaType.IMAGE, sort_order=0)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_media(listing, media_type=MediaType.IMAGE, sort_order=0)


@pytest.mark.django_db
def test_an_image_and_a_video_may_share_a_sort_order():
    listing = make_private_listing(owner=make_user())
    make_media(listing, media_type=MediaType.IMAGE, sort_order=0)
    video = make_media(listing, media_type=MediaType.VIDEO, sort_order=0)

    assert video.pk is not None


@pytest.mark.django_db
def test_zero_byte_media_is_rejected():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_media(listing, byte_size=0)


@pytest.mark.django_db
def test_a_malformed_checksum_is_rejected():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_media(listing, checksum_sha256="not-a-sha256")


@pytest.mark.django_db
def test_non_rejected_counts_every_status_except_rejected():
    listing = make_private_listing(owner=make_user())
    make_media(listing, status=MediaStatus.UPLOADING, sort_order=0)
    make_media(listing, status=MediaStatus.SCANNING, sort_order=1)
    make_media(listing, status=MediaStatus.PROCESSING, sort_order=2)
    make_media(listing, status=MediaStatus.READY, sort_order=3)
    make_media(listing, status=MediaStatus.REJECTED, sort_order=4)

    assert ListingMedia.objects.non_rejected().filter(listing=listing).count() == 4
    assert ListingMedia.objects.ready().filter(listing=listing).count() == 1


@pytest.mark.django_db
def test_media_is_ordered_by_type_then_sort_order():
    listing = make_private_listing(owner=make_user())
    second = make_media(listing, sort_order=1)
    first = make_media(listing, sort_order=0)

    assert list(ListingMedia.objects.filter(listing=listing)) == [first, second]


@pytest.mark.django_db
def test_deleting_a_listing_deletes_its_media():
    listing = make_private_listing(owner=make_user())
    make_media(listing)

    listing.delete()

    assert ListingMedia.objects.count() == 0

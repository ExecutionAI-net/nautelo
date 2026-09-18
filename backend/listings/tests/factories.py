import hashlib
import uuid
from decimal import Decimal

from django.utils import timezone

from accounts.enums import SellerType
from listings.enums import MediaStatus, MediaType, RevisionOrigin, RevisionStatus
from listings.models import BoatListing, ListingMedia, ListingRevision, ListingSnapshot
from taxonomy.models import BoatBrand, BoatModel


def make_brand(name="Beneteau"):
    return BoatBrand.objects.create(name=name)


def make_model(brand, name="Oceanis 46.1"):
    return BoatModel.objects.create(brand=brand, name=name)


def other_model_for(brand):
    """The per-brand Other placeholder taxonomy creates automatically via a
    post_save signal on BoatBrand (see backend/taxonomy/signals.py)."""
    return BoatModel.objects.get(brand=brand, is_other_placeholder=True)


def make_private_listing(*, owner, brand=None, model=None, **kwargs):
    brand = brand or make_brand(f"Brand {owner.pk.hex[:8]}")
    model = model or make_model(brand)
    defaults = {
        "owner_user": owner,
        "broker": None,
        "seller_type": SellerType.PRIVATE,
        "brand": brand,
        "model": model,
        "manufacture_year": 2020,
        "currency": "EUR",
        "price": Decimal("125000.00"),
        "created_by": owner,
    }
    defaults.update(kwargs)
    return BoatListing.objects.create(**defaults)


def make_broker_listing(*, broker, actor, brand=None, model=None, **kwargs):
    brand = brand or make_brand(f"Brand {broker.pk.hex[:8]}")
    model = model or make_model(brand)
    defaults = {
        "owner_user": None,
        "broker": broker,
        "seller_type": SellerType.BROKER,
        "brand": brand,
        "model": model,
        "manufacture_year": 2021,
        "currency": "EUR",
        "price": Decimal("459000.00"),
        "created_by": actor,
    }
    defaults.update(kwargs)
    return BoatListing.objects.create(**defaults)


def make_media(listing, *, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=0, **kwargs):
    unique = uuid.uuid4().hex
    defaults = {
        "listing": listing,
        "media_type": media_type,
        "status": status,
        "sort_order": sort_order,
        "storage_key": f"listings/{listing.pk}/{unique}",
        "mime_type": "image/jpeg" if media_type == MediaType.IMAGE else "video/mp4",
        "byte_size": 204_800,
        "width": 1920 if media_type == MediaType.IMAGE else 1280,
        "height": 1080 if media_type == MediaType.IMAGE else 720,
        "duration_seconds": None if media_type == MediaType.IMAGE else 45,
        "checksum_sha256": hashlib.sha256(unique.encode()).hexdigest(),
    }
    defaults.update(kwargs)
    return ListingMedia.objects.create(**defaults)


def make_revision(listing, **kwargs):
    defaults = {
        "listing": listing,
        "revision_number": listing.revisions.count() + 1,
        "state": RevisionStatus.DRAFT,
        "origin": RevisionOrigin.OWNER,
        "payload": {},
    }
    defaults.update(kwargs)
    return ListingRevision.objects.create(**defaults)


def make_snapshot(listing, *, approved_by, version=1, **kwargs):
    defaults = {
        "listing": listing,
        "version": version,
        "brand_name_snapshot": listing.brand.name,
        "model_name_snapshot": listing.model.name,
        "custom_model_name_snapshot": listing.custom_model_name,
        "manufacture_year_snapshot": listing.manufacture_year,
        "title_en": "A very nice boat",
        "description_en": "Well kept, one owner.",
        "specifications": {"length_m": "14.6"},
        "specifications_schema_version": 1,
        "location_country": "IT",
        "location_city": "Genoa",
        "currency": listing.currency,
        "price": listing.price,
        "media_manifest": [],
        "approved_by": approved_by,
        "approved_at": timezone.now(),
    }
    defaults.update(kwargs)
    return ListingSnapshot.objects.create(**defaults)

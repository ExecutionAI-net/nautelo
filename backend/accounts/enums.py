from django.db import models


class UserRole(models.TextChoices):
    """The single primary marketplace role held by every account (spec 5, 11.1)."""

    BUYER = "BUYER", "Buyer"
    PRIVATE_SELLER = "PRIVATE_SELLER", "Private seller"
    BROKER = "BROKER", "Broker"
    SERVICE_PROVIDER = "SERVICE_PROVIDER", "Service provider"
    STAFF = "STAFF", "Staff"


class Locale(models.TextChoices):
    """Supported interface languages - exactly these three (spec 0)."""

    EN = "EN", "English"
    IT = "IT", "Italiano"
    ES = "ES", "Espanol"


class SellerType(models.TextChoices):
    """Canonical seller-type enum. Phase 11's BoatListing.seller_type imports this."""

    PRIVATE = "PRIVATE", "Private seller"
    BROKER = "BROKER", "Broker"


class StaffGroup:
    """Django auth Group names splitting spec 5's staff moderator / staff admin tiers."""

    MODERATOR = "staff_moderator"
    ADMIN = "staff_admin"
    ALL = (MODERATOR, ADMIN)

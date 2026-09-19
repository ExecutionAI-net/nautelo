"""Listing domain models (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §11.4, §11.5).

Public pages read from BoatListing.current_public_snapshot, never from the
mutable draft columns below (spec §11.4).
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.db.models import Q
from django.utils import timezone

from accounts.enums import SellerType
from common.models import UUIDModel, UUIDTimeStampedModel

from .enums import (
    ListingStatus,
    MediaStatus,
    MediaType,
    PublicationSource,
    RevisionOrigin,
    RevisionStatus,
)

MIN_MANUFACTURE_YEAR = 1900
CUSTOM_MODEL_NAME_MIN_LENGTH = 2
CUSTOM_MODEL_NAME_MAX_LENGTH = 100
# Spec §11.4: "currency ISO-4217, initially EUR". Spec §18.2 requires an
# eligibility check for "listing.currency is supported", so the supported set is
# explicit rather than implied.
SUPPORTED_CURRENCIES = frozenset({"EUR"})


class BoatListing(UUIDTimeStampedModel):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="owned_listings",
    )
    broker = models.ForeignKey(
        "brokers.BrokerOrganization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="listings",
    )
    seller_type = models.CharField(max_length=7, choices=SellerType.choices)
    brand = models.ForeignKey(
        "taxonomy.BoatBrand", on_delete=models.PROTECT, related_name="listings"
    )
    model = models.ForeignKey(
        "taxonomy.BoatModel", on_delete=models.PROTECT, related_name="listings"
    )
    custom_model_name = models.CharField(
        max_length=CUSTOM_MODEL_NAME_MAX_LENGTH, blank=True, default=""
    )
    manufacture_year = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=16, choices=ListingStatus.choices, default=ListingStatus.DRAFT
    )
    currency = models.CharField(max_length=3, default="EUR")
    price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    show_finance_estimate = models.BooleanField(default=False)
    finance_down_payment_override_percent = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True
    )
    finance_rate_override_percent = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True
    )
    finance_term_override_months = models.PositiveIntegerField(null=True, blank=True)
    publication_source = models.CharField(
        max_length=16, choices=PublicationSource.choices, blank=True, default=""
    )
    # Spec §11.9's ledger row this listing's publication was paid for with.
    # PROTECT, not SET_NULL: the ledger is the only record of *why* this listing
    # was allowed to publish, and spec §2.4 makes that auditable forever. Set
    # exactly once, inside listings.submissions.submit_listing_revision's
    # transaction (spec §22.4).
    consumed_entitlement = models.ForeignKey(
        "entitlements.UserEntitlement",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    published_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    current_public_snapshot = models.ForeignKey(
        "listings.ListingSnapshot",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    view_count_cached = models.BigIntegerField(default=0)
    # Optimistic locking (spec §20.5); bumped by listings.locking.bump_version().
    version = models.PositiveIntegerField(default=1)
    # Spec 4.1's canonical /boats/<listing-slug>/. Assigned once, at first
    # publication, and never changed afterwards so a shared link stays valid.
    slug = models.SlugField(max_length=190, unique=True, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-published_at"]),
            models.Index(fields=["owner_user", "status"]),
            models.Index(fields=["broker", "status"]),
            models.Index(fields=["expires_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=~Q(seller_type=SellerType.PRIVATE)
                | (Q(owner_user__isnull=False) & Q(broker__isnull=True)),
                name="listings_private_requires_owner_and_no_broker",
            ),
            models.CheckConstraint(
                condition=~Q(seller_type=SellerType.BROKER)
                | (Q(broker__isnull=False) & Q(owner_user__isnull=True)),
                name="listings_broker_requires_org_and_no_owner",
            ),
            models.CheckConstraint(
                condition=Q(show_finance_estimate=False)
                | Q(seller_type=SellerType.BROKER),
                name="listings_finance_flag_requires_broker",
            ),
            models.CheckConstraint(
                condition=Q(manufacture_year__gte=MIN_MANUFACTURE_YEAR),
                name="listings_manufacture_year_at_least_1900",
            ),
            models.CheckConstraint(
                condition=Q(price__isnull=True) | Q(price__gt=0),
                name="listings_price_is_positive_when_present",
            ),
            models.CheckConstraint(
                condition=Q(custom_model_name="")
                | Q(
                    custom_model_name__regex=(
                        rf"^.{{{CUSTOM_MODEL_NAME_MIN_LENGTH},"
                        rf"{CUSTOM_MODEL_NAME_MAX_LENGTH}}}$"
                    )
                ),
                name="listings_custom_model_name_length_2_to_100",
            ),
            # Spec §17.3: a 100% down payment leaves zero principal, so this
            # override's ceiling is 99.99%, unlike the rate override below
            # which allows the full 0-100% range. Mirrors the application-level
            # bound enforced in listings.payloads._clean_percent.
            models.CheckConstraint(
                condition=Q(finance_down_payment_override_percent__isnull=True)
                | (
                    Q(finance_down_payment_override_percent__gte=0)
                    & Q(finance_down_payment_override_percent__lte=99.99)
                ),
                name="listings_finance_down_payment_override_percent_0_to_99_99",
            ),
            models.CheckConstraint(
                condition=Q(finance_rate_override_percent__isnull=True)
                | (
                    Q(finance_rate_override_percent__gte=0)
                    & Q(finance_rate_override_percent__lte=100)
                ),
                name="listings_finance_rate_override_percent_0_to_100",
            ),
        ]

    def __str__(self):
        return f"{self.brand_id} {self.model_id} ({self.status})"

    @staticmethod
    def max_manufacture_year() -> int:
        """Spec §11.4: "between 1900 and current year + 1"."""
        return timezone.now().year + 1

    def clean(self):
        errors = {}

        if self.currency not in SUPPORTED_CURRENCIES:
            errors["currency"] = (
                f"Unsupported currency: {self.currency}. "
                f"Supported: {', '.join(sorted(SUPPORTED_CURRENCIES))}."
            )

        if (
            self.manufacture_year is not None
            and self.manufacture_year > self.max_manufacture_year()
        ):
            errors["manufacture_year"] = (
                f"Manufacture year must not be later than {self.max_manufacture_year()}."
            )

        # Cross-table rule (spec §11.4) — cannot be a database CheckConstraint.
        if self.model_id is not None:
            trimmed = (self.custom_model_name or "").strip()
            if self.model.is_other_placeholder:
                if not (
                    CUSTOM_MODEL_NAME_MIN_LENGTH
                    <= len(trimmed)
                    <= CUSTOM_MODEL_NAME_MAX_LENGTH
                ):
                    errors["custom_model_name"] = (
                        "The Other model requires custom text between "
                        f"{CUSTOM_MODEL_NAME_MIN_LENGTH} and "
                        f"{CUSTOM_MODEL_NAME_MAX_LENGTH} characters."
                    )
            elif trimmed:
                errors["custom_model_name"] = (
                    "Custom model text is only allowed when the Other model is selected."
                )

        if errors:
            raise ValidationError(errors)


class ListingMediaQuerySet(models.QuerySet):
    def non_rejected(self):
        """Spec §11.5: "Media count limits include all non-rejected items to
        prevent concurrent upload bypasses."""
        return self.exclude(status=MediaStatus.REJECTED)

    def ready(self):
        """Spec §11.5: "Only READY media can enter a submitted revision/public
        snapshot."""
        return self.filter(status=MediaStatus.READY)


class ListingMedia(UUIDTimeStampedModel):
    """Spec §11.5. This phase owns the model only — the upload/scan/transcode
    pipeline is spec Phase 15 (§24), which will drive `status` for real."""

    listing = models.ForeignKey(
        BoatListing, on_delete=models.CASCADE, related_name="media"
    )
    media_type = models.CharField(max_length=5, choices=MediaType.choices)
    storage_key = models.CharField(max_length=500)
    status = models.CharField(
        max_length=10, choices=MediaStatus.choices, default=MediaStatus.UPLOADING
    )
    mime_type = models.CharField(max_length=100)
    byte_size = models.PositiveBigIntegerField()
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    checksum_sha256 = models.CharField(max_length=64)
    # Spec 24.2 step 8: REJECTED with a user-safe reason.
    rejection_reason = models.CharField(max_length=200, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    objects = ListingMediaQuerySet.as_manager()

    class Meta:
        ordering = ["media_type", "sort_order", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "storage_key"],
                name="listings_media_unique_storage_key_per_listing",
            ),
            models.UniqueConstraint(
                fields=["listing", "media_type", "sort_order"],
                name="listings_media_unique_sort_order_per_type",
            ),
            models.CheckConstraint(
                condition=Q(byte_size__gt=0),
                name="listings_media_byte_size_is_positive",
            ),
            models.CheckConstraint(
                condition=Q(checksum_sha256__regex=r"^[0-9a-f]{64}$"),
                name="listings_media_checksum_is_lowercase_sha256_hex",
            ),
        ]

    def __str__(self):
        return f"{self.media_type} {self.storage_key} ({self.status})"


# Ordered tuples for use inside CheckConstraints. frozenset iteration order is
# not stable across processes, so embedding listings.enums' frozensets directly
# would make `makemigrations` emit a spurious migration at random. The test
# `test_constraint_state_tuples_match_the_enum_groupings` pins these to the
# canonical groupings so they cannot drift apart.
CONSTRAINT_OPEN_STATES = (RevisionStatus.DRAFT, RevisionStatus.SUBMITTED)
CONSTRAINT_DECIDED_STATES = (
    RevisionStatus.APPROVED,
    RevisionStatus.CHANGES_REQUESTED,
    RevisionStatus.REJECTED,
)
CONSTRAINT_NOTE_REQUIRED_STATES = (
    RevisionStatus.CHANGES_REQUESTED,
    RevisionStatus.REJECTED,
)


class ListingSnapshotQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValueError(
            "ListingSnapshot rows are immutable public content; "
            "bulk update is not permitted."
        )


class ListingSnapshot(UUIDModel):
    """Immutable, versioned public content (spec §11.4).

    Public pages read this, never BoatListing's mutable draft columns. Rows are
    written only by listings.snapshots.create_snapshot_from_revision() and are
    never rewritten: a taxonomy correction or a later edit creates the *next*
    version and leaves history intact (spec §11.4, §20.3).

    Inherits UUIDModel rather than UUIDTimeStampedModel deliberately: an
    `updated_at` column on an immutable row would be a lie (see the docstring on
    common.models.TimeStampedModel and the same decision in audit.AuditEvent).
    """

    listing = models.ForeignKey(
        BoatListing, on_delete=models.CASCADE, related_name="snapshots"
    )
    version = models.PositiveIntegerField()
    approved_revision = models.ForeignKey(
        "listings.ListingRevision",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="approved_snapshots",
    )
    brand_name_snapshot = models.CharField(max_length=150)
    model_name_snapshot = models.CharField(max_length=150)
    custom_model_name_snapshot = models.CharField(
        max_length=CUSTOM_MODEL_NAME_MAX_LENGTH, blank=True, default=""
    )
    manufacture_year_snapshot = models.PositiveSmallIntegerField()
    title_en = models.CharField(max_length=200)
    title_it = models.CharField(max_length=200, blank=True, default="")
    title_es = models.CharField(max_length=200, blank=True, default="")
    description_en = models.TextField()
    description_it = models.TextField(blank=True, default="")
    description_es = models.TextField(blank=True, default="")
    specifications = models.JSONField(default=dict, encoder=DjangoJSONEncoder)
    specifications_schema_version = models.PositiveIntegerField(default=1)
    location_country = models.CharField(max_length=2)
    location_region = models.CharField(max_length=120, blank=True, default="")
    location_city = models.CharField(max_length=120)
    currency = models.CharField(max_length=3)
    price = models.DecimalField(max_digits=14, decimal_places=2)
    # Spec §18.2 reads these four as "listing.show_finance_estimate" etc. They
    # are snapshotted rather than read off the BoatListing row because those
    # columns are draft state (listings.drafts._apply_payload_to_listing writes
    # them on every draft save) and spec §36.1 requires that "draft broker
    # finance settings do not leak before publication". Written only by
    # listings.snapshots.create_snapshot_from_revision; read only by
    # finance.listing_quotes.
    show_finance_estimate = models.BooleanField(default=False)
    finance_down_payment_override_percent = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True
    )
    finance_rate_override_percent = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True
    )
    finance_term_override_months = models.PositiveIntegerField(null=True, blank=True)
    media_manifest = models.JSONField(default=list, encoder=DjangoJSONEncoder)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    approved_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ListingSnapshotQuerySet.as_manager()

    class Meta:
        ordering = ["listing", "-version"]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "version"],
                name="listings_snapshot_unique_version_per_listing",
            ),
            models.CheckConstraint(
                condition=Q(version__gte=1),
                name="listings_snapshot_version_is_positive",
            ),
            models.CheckConstraint(
                condition=Q(price__gt=0), name="listings_snapshot_price_is_positive"
            ),
        ]

    def __str__(self):
        return f"{self.listing_id} v{self.version}"

    def save(self, *args, **kwargs):
        # `_state.adding` rather than `pk is None`: UUIDModel assigns the pk at
        # instantiation, so a brand-new unsaved row already has one.
        if not self._state.adding:
            raise ValueError("ListingSnapshot rows are immutable once created.")
        super().save(*args, **kwargs)


class ListingRevision(UUIDTimeStampedModel):
    """A proposed change to a listing (spec §11.4, §6.2).

    `payload` is the single write surface for editable content and is validated
    against the explicit schema in listings.payloads before it is ever stored.
    """

    listing = models.ForeignKey(
        BoatListing, on_delete=models.CASCADE, related_name="revisions"
    )
    revision_number = models.PositiveIntegerField()
    base_snapshot = models.ForeignKey(
        ListingSnapshot,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="based_revisions",
    )
    state = models.CharField(
        max_length=17, choices=RevisionStatus.choices, default=RevisionStatus.DRAFT
    )
    origin = models.CharField(
        max_length=16, choices=RevisionOrigin.choices, default=RevisionOrigin.OWNER
    )
    payload = models.JSONField(default=dict, encoder=DjangoJSONEncoder)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="submitted_listing_revisions",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="decided_listing_revisions",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True, default="")
    # Optimistic locking (spec §20.5); bumped by listings.locking.bump_version().
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["listing", "-revision_number"]
        indexes = [models.Index(fields=["state", "submitted_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "revision_number"],
                name="listings_revision_unique_number_per_listing",
            ),
            models.UniqueConstraint(
                fields=["listing"],
                condition=Q(state__in=CONSTRAINT_OPEN_STATES),
                name="listings_revision_one_open_per_listing",
            ),
            models.CheckConstraint(
                condition=Q(state=RevisionStatus.DRAFT)
                | (Q(submitted_by__isnull=False) & Q(submitted_at__isnull=False)),
                name="listings_revision_non_draft_requires_submission_stamps",
            ),
            models.CheckConstraint(
                condition=~Q(state__in=CONSTRAINT_DECIDED_STATES)
                | (Q(decided_by__isnull=False) & Q(decided_at__isnull=False)),
                name="listings_revision_decided_requires_decision_stamps",
            ),
            models.CheckConstraint(
                condition=~Q(state__in=CONSTRAINT_NOTE_REQUIRED_STATES)
                | ~Q(decision_note=""),
                name="listings_revision_refusal_requires_a_note",
            ),
            models.CheckConstraint(
                condition=Q(revision_number__gte=1),
                name="listings_revision_number_is_positive",
            ),
        ]

    def __str__(self):
        return f"{self.listing_id} r{self.revision_number} ({self.state})"

import json

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from audit.models import AuditEvent
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile
from services_catalog.models import (
    LegacyDirectoryMapping,
    ProfessionalService,
    ServiceCategory,
)
from services_catalog.services import legacy_dedup_key, save_service_category


class Command(BaseCommand):
    help = (
        "Import legacy service/provider records into the canonical directory, "
        "following spec §14.3's six-step recipe. There is no legacy data in "
        "this project (the prior artefact was static HTML mockups), so this "
        "command exists as the sanctioned mechanism and is not run in any "
        "environment."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            required=True,
            help='JSON file: {"services": [...], "providers": [...]}',
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing anything.",
        )

    def handle(self, *args, **options):
        payload = self._load(options["source"])
        services = payload.get("services") or []
        providers = payload.get("providers") or []
        dry_run = options["dry_run"]

        counts = {
            "services_read": len(services),
            "providers_read": len(providers),
            "mapped": 0,
            "duplicate_review": 0,
            "unresolved": 0,
            "descriptions_copied": 0,
            "categories_attached": 0,
            "slugs_preserved": 0,
            "slugs_changed": 0,
        }

        try:
            with transaction.atomic():
                for record in services:
                    self._import_service(record, counts)
                for record in providers:
                    self._import_provider(record, counts)
                if dry_run:
                    self.stdout.write(self.style.WARNING("DRY RUN — rolling back."))
                    transaction.set_rollback(True)
        except KeyError as exc:
            raise CommandError(f"Legacy record is missing a required key: {exc}") from exc
        except TypeError as exc:
            raise CommandError(f"Legacy record has an unexpected shape: {exc}") from exc

        self._report(counts, dry_run)

    # -- step 0 ---------------------------------------------------------------

    def _load(self, path):
        try:
            with open(path, encoding="utf-8") as handle:
                payload = json.load(handle)
        except OSError as exc:
            raise CommandError(f"Cannot read {path}: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise CommandError(f"{path} is not valid JSON: {exc}") from exc
        if not isinstance(payload, dict):
            raise CommandError(f"{path} must contain a JSON object.")
        return payload

    # -- steps 1-3 for legacy service records ---------------------------------

    def _import_service(self, record, counts):
        legacy_id = str(record["legacy_id"])
        slug = (record.get("slug") or "").strip()
        name = record.get("name") or ""
        normalized_name, normalized_address = legacy_dedup_key(name, "")

        category = ServiceCategory.objects.filter(slug=slug).first() if slug else None
        if category is None:
            category = self._match_category_by_name(normalized_name)

        if category is None:
            self._write_mapping(
                LegacyDirectoryMapping.LegacyKind.SERVICE,
                legacy_id,
                slug,
                normalized_name,
                normalized_address,
                resolution=LegacyDirectoryMapping.Resolution.UNRESOLVED,
                notes="No ServiceCategory matched this legacy service record.",
                counts=counts,
            )
            return

        # Step 3: copy a missing description, never overwrite one. The write
        # goes through save_service_category, not category.save(): rule 5 of
        # this plan's contract makes that the only sanctioned write path for
        # ServiceCategory, and a management command is not an exception to it.
        # actor=None + ActorType.SYSTEM + Source.TASK is how audit.models
        # already models a non-interactive actor.
        description = (record.get("description") or "").strip()
        if description and not category.description_en:
            category.description_en = description
            save_service_category(
                category=category,
                actor=None,
                actor_type=AuditEvent.ActorType.SYSTEM,
                source=AuditEvent.Source.TASK,
            )
            counts["descriptions_copied"] += 1

        # Step 6: the six SEO records stay independent — never deactivated,
        # never reparented, never merged into another category. Nothing in this
        # method writes is_active, has_seo_page or any parent link.
        self._write_mapping(
            LegacyDirectoryMapping.LegacyKind.SERVICE,
            legacy_id,
            slug,
            normalized_name,
            normalized_address,
            resolution=LegacyDirectoryMapping.Resolution.MAPPED,
            target_type=LegacyDirectoryMapping.TargetType.SERVICE_CATEGORY,
            target_id=category.pk,
            counts=counts,
        )

    def _match_category_by_name(self, normalized_name):
        if not normalized_name:
            return None
        for candidate in ServiceCategory.objects.filter(is_active=True):
            if legacy_dedup_key(candidate.name_en, "")[0] == normalized_name:
                return candidate
        return None

    # -- steps 1-4 for legacy provider records --------------------------------

    def _import_provider(self, record, counts):
        legacy_id = str(record["legacy_id"])
        legacy_slug = (record.get("slug") or "").strip()
        display_name = record.get("display_name") or ""
        address = record.get("address") or ""
        normalized_name, normalized_address = legacy_dedup_key(display_name, address)

        profile, resolution, notes = self._resolve_provider(
            legacy_slug, normalized_name, normalized_address
        )

        if profile is None:
            self._write_mapping(
                LegacyDirectoryMapping.LegacyKind.PROVIDER,
                legacy_id,
                legacy_slug,
                normalized_name,
                normalized_address,
                resolution=resolution,
                notes=notes,
                counts=counts,
            )
            return

        # Step 4: preserve the slug where it is unique; otherwise the mapping
        # row is what makes the old URL redirect deterministically.
        if legacy_slug and legacy_slug == profile.slug:
            counts["slugs_preserved"] += 1
        elif legacy_slug:
            counts["slugs_changed"] += 1

        # Step 3: copy missing descriptions and categories, never overwrite.
        description = (record.get("description") or "").strip()
        if description and not profile.description:
            profile.description = description
            profile.save(update_fields=["description", "updated_at"])
            counts["descriptions_copied"] += 1

        for category_slug in record.get("categories") or []:
            category = ServiceCategory.objects.filter(
                slug=str(category_slug).strip(), is_active=True
            ).first()
            if category is None:
                continue
            # Look up by (professional, category) only — never by title_en. That
            # field is also part of unique_professional_category_title, so
            # including it in the lookup key means a staff rename of title_en
            # after the first import makes the second run miss the existing
            # row and create a duplicate instead of finding it. title_en (and
            # service_area) are only ever set on create, mirroring the "only
            # copy when empty" rule used for descriptions above: an existing
            # row's title_en is never overwritten by a later import.
            _, created = ProfessionalService.objects.get_or_create(
                professional=profile,
                category=category,
                defaults={
                    "title_en": category.name_en,
                    "service_area": list(profile.service_area or []),
                },
            )
            if created:
                counts["categories_attached"] += 1

        self._write_mapping(
            LegacyDirectoryMapping.LegacyKind.PROVIDER,
            legacy_id,
            legacy_slug,
            normalized_name,
            normalized_address,
            resolution=LegacyDirectoryMapping.Resolution.MAPPED,
            target_type=LegacyDirectoryMapping.TargetType.PROFESSIONAL_PROFILE,
            target_id=profile.pk,
            counts=counts,
        )

    def _resolve_provider(self, legacy_slug, normalized_name, normalized_address):
        """Spec §14.3 step 2, in strict precedence order.

        Tier 1: the explicit legacy identifier (the slug carried by the old
        record). Tier 2: normalized display name *and* normalized address.
        Tier 3: the name alone, which is never a merge — it returns no target
        and a DUPLICATE_REVIEW resolution naming the conflicting rows.
        """
        active = ProfessionalProfile.objects.filter(status=ProfessionalProfileStatus.ACTIVE)

        if legacy_slug:
            exact = active.filter(slug=legacy_slug).first()
            if exact is not None:
                return exact, LegacyDirectoryMapping.Resolution.MAPPED, ""

        if not normalized_name:
            return (
                None,
                LegacyDirectoryMapping.Resolution.UNRESOLVED,
                "No active ProfessionalProfile matched this legacy provider record.",
            )

        name_only_matches = []
        for candidate in active:
            candidate_address = " ".join(
                part
                for part in (
                    candidate.address_line1,
                    candidate.address_line2,
                    candidate.city,
                    candidate.postal_code,
                    candidate.region,
                )
                if part
            )
            candidate_name, candidate_addr = legacy_dedup_key(
                candidate.display_name, candidate_address
            )
            if candidate_name != normalized_name:
                continue
            if normalized_address and candidate_addr == normalized_address:
                return candidate, LegacyDirectoryMapping.Resolution.MAPPED, ""
            name_only_matches.append(candidate)

        if name_only_matches:
            # Never merge solely on display name (spec §14.3 step 2).
            slugs = ", ".join(sorted(profile.slug for profile in name_only_matches))
            return (
                None,
                LegacyDirectoryMapping.Resolution.DUPLICATE_REVIEW,
                f"Display name matches {slugs} but the address does not. "
                "A human must confirm or reject the merge.",
            )

        return (
            None,
            LegacyDirectoryMapping.Resolution.UNRESOLVED,
            "No active ProfessionalProfile matched this legacy provider record.",
        )

    # -- step 1: the mapping table -------------------------------------------

    def _write_mapping(
        self,
        legacy_kind,
        legacy_identifier,
        legacy_slug,
        normalized_name,
        normalized_address,
        *,
        resolution,
        counts,
        target_type="",
        target_id=None,
        notes="",
    ):
        LegacyDirectoryMapping.objects.update_or_create(
            legacy_kind=legacy_kind,
            legacy_identifier=legacy_identifier,
            defaults={
                "legacy_slug": legacy_slug,
                "normalized_name": normalized_name,
                "normalized_address": normalized_address,
                "target_type": target_type,
                "target_id": target_id,
                "resolution": resolution,
                "notes": notes,
            },
        )
        if resolution == LegacyDirectoryMapping.Resolution.MAPPED:
            counts["mapped"] += 1
        elif resolution == LegacyDirectoryMapping.Resolution.DUPLICATE_REVIEW:
            counts["duplicate_review"] += 1
        else:
            counts["unresolved"] += 1

    # -- steps 5-6: reconciliation report ------------------------------------

    def _report(self, counts, dry_run):
        self.stdout.write("Legacy directory import reconciliation report")
        self.stdout.write(f"  services read: {counts['services_read']}")
        self.stdout.write(f"  providers read: {counts['providers_read']}")
        self.stdout.write(f"  mapped: {counts['mapped']}")
        self.stdout.write(f"  needs review (duplicate): {counts['duplicate_review']}")
        self.stdout.write(f"  unresolved: {counts['unresolved']}")
        self.stdout.write(f"  descriptions copied: {counts['descriptions_copied']}")
        self.stdout.write(f"  categories attached: {counts['categories_attached']}")
        self.stdout.write(f"  slugs preserved: {counts['slugs_preserved']}")
        self.stdout.write(f"  slugs changed (redirect via mapping): {counts['slugs_changed']}")
        # Spec §14.3 step 5.
        self.stdout.write(
            "  sitemap and canonical tags regenerate from the database on the "
            "next request; there is no static file to rebuild."
        )
        # Spec §14.3 step 6.
        self.stdout.write(
            "  the six SEO service categories were left independent and active."
        )
        if dry_run:
            self.stdout.write(self.style.WARNING("Nothing was written (dry run)."))
        else:
            self.stdout.write(self.style.SUCCESS("Import complete."))

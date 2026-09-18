import json

import pytest
from django.core.management import call_command

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional
from services_catalog.models import (
    LegacyDirectoryMapping,
    ProfessionalService,
    ServiceCategory,
)


def write_source(tmp_path, payload):
    path = tmp_path / "legacy.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return str(path)


def build_professional(email, *, slug, display_name, **extra):
    return make_professional(
        make_user(email, role=UserRole.SERVICE_PROVIDER),
        slug=slug,
        display_name=display_name,
        status=ProfessionalProfileStatus.ACTIVE,
        **extra,
    )


@pytest.mark.django_db
def test_an_empty_source_imports_nothing_and_reports_zeroes(tmp_path, capsys):
    source = write_source(tmp_path, {"services": [], "providers": []})

    call_command("import_legacy_directory", f"--source={source}")

    output = capsys.readouterr().out
    assert "providers read: 0" in output
    assert "services read: 0" in output
    assert LegacyDirectoryMapping.objects.count() == 0


@pytest.mark.django_db
def test_a_provider_matching_by_slug_is_mapped(tmp_path):
    pro = build_professional("a@example.com", slug="ocean-legal", display_name="Ocean Legal")
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {
                    "legacy_id": "4821",
                    "slug": "ocean-legal",
                    "display_name": "Ocean Legal",
                    "address": "Via del Porto 1, Livorno",
                }
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    mapping = LegacyDirectoryMapping.objects.get(legacy_identifier="4821")
    assert mapping.resolution == LegacyDirectoryMapping.Resolution.MAPPED
    assert mapping.target_id == pro.pk
    assert mapping.target_type == LegacyDirectoryMapping.TargetType.PROFESSIONAL_PROFILE


@pytest.mark.django_db
def test_a_provider_matching_on_normalized_name_and_address_is_mapped(tmp_path):
    pro = build_professional(
        "b@example.com",
        slug="ocean-legal",
        display_name="Océan Legal",
        address_line1="Via del Porto 1",
        city="Livorno",
    )
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {
                    "legacy_id": "700",
                    "slug": "ocean-legal-old",
                    "display_name": "OCEAN  LEGAL",
                    "address": "via del porto 1 livorno",
                }
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    mapping = LegacyDirectoryMapping.objects.get(legacy_identifier="700")
    assert mapping.resolution == LegacyDirectoryMapping.Resolution.MAPPED
    assert mapping.target_id == pro.pk
    assert mapping.legacy_slug == "ocean-legal-old"


@pytest.mark.django_db
def test_a_name_only_match_is_flagged_for_review_and_never_merged(tmp_path):
    build_professional(
        "c@example.com", slug="ocean-legal", display_name="Ocean Legal", city="Livorno"
    )
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {
                    "legacy_id": "900",
                    "slug": "ocean-legal-palma",
                    "display_name": "Ocean Legal",
                    "address": "Passeig Maritim 9, Palma",
                }
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    mapping = LegacyDirectoryMapping.objects.get(legacy_identifier="900")
    assert mapping.resolution == LegacyDirectoryMapping.Resolution.DUPLICATE_REVIEW
    assert mapping.target_id is None
    assert "ocean-legal" in mapping.notes


@pytest.mark.django_db
def test_an_unmatched_provider_is_recorded_as_unresolved(tmp_path):
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {"legacy_id": "404", "slug": "gone", "display_name": "Gone", "address": ""}
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    mapping = LegacyDirectoryMapping.objects.get(legacy_identifier="404")
    assert mapping.resolution == LegacyDirectoryMapping.Resolution.UNRESOLVED


@pytest.mark.django_db
def test_missing_descriptions_are_copied_but_existing_ones_are_never_overwritten(tmp_path):
    blank = build_professional("d@example.com", slug="blank-pro", display_name="Blank Pro")
    filled = build_professional(
        "e@example.com",
        slug="filled-pro",
        display_name="Filled Pro",
        description="Written by staff.",
    )
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {
                    "legacy_id": "1",
                    "slug": "blank-pro",
                    "display_name": "Blank Pro",
                    "address": "",
                    "description": "Legacy copy.",
                },
                {
                    "legacy_id": "2",
                    "slug": "filled-pro",
                    "display_name": "Filled Pro",
                    "address": "",
                    "description": "Legacy copy.",
                },
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    blank.refresh_from_db()
    filled.refresh_from_db()
    assert blank.description == "Legacy copy."
    assert filled.description == "Written by staff."


@pytest.mark.django_db
def test_a_staff_edit_after_the_first_import_survives_a_second_import(tmp_path):
    """The "only copy when empty" rule is what makes re-running safe.

    A staff member rewrites the description the first run copied; the second run
    must leave that edit exactly as it is, on both the ProfessionalProfile and
    the ServiceCategory write paths.
    """
    pro = build_professional("staff@example.com", slug="edited-pro", display_name="Edited Pro")
    source = write_source(
        tmp_path,
        {
            "services": [
                {
                    "legacy_id": "s9",
                    "slug": "insurance",
                    "name": "Insurance",
                    "description": "Legacy insurance blurb.",
                }
            ],
            "providers": [
                {
                    "legacy_id": "20",
                    "slug": "edited-pro",
                    "display_name": "Edited Pro",
                    "address": "",
                    "description": "Legacy copy.",
                }
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    pro.refresh_from_db()
    assert pro.description == "Legacy copy."
    category = ServiceCategory.objects.get(slug="insurance")
    assert category.description_en == "Legacy insurance blurb."

    pro.description = "Rewritten by staff after the import."
    pro.save(update_fields=["description", "updated_at"])
    category.description_en = "Rewritten by staff after the import."
    category.save(update_fields=["description_en", "updated_at"])

    call_command("import_legacy_directory", f"--source={source}")

    pro.refresh_from_db()
    category.refresh_from_db()
    assert pro.description == "Rewritten by staff after the import."
    assert category.description_en == "Rewritten by staff after the import."


@pytest.mark.django_db
def test_legacy_categories_become_professional_services_only_when_missing(tmp_path):
    # The six SEO categories are seeded by migration 0002, so "legal" is fetched,
    # not created: this test's fixture references it as a real catalog slug that
    # the import must resolve against, which is the behaviour under test.
    legal = ServiceCategory.objects.get(slug="legal")
    pro = build_professional("f@example.com", slug="cat-pro", display_name="Cat Pro")
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {
                    "legacy_id": "3",
                    "slug": "cat-pro",
                    "display_name": "Cat Pro",
                    "address": "",
                    "categories": ["legal", "unknown-category"],
                }
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")
    call_command("import_legacy_directory", f"--source={source}")

    services = ProfessionalService.objects.filter(professional=pro)
    assert services.count() == 1
    assert services.first().category == legal


@pytest.mark.django_db
def test_a_renamed_professional_service_title_is_not_duplicated_on_reimport(tmp_path):
    """The ProfessionalService write path must key on (professional, category),
    not on title_en.

    title_en is part of unique_professional_category_title, so if the
    get_or_create lookup also includes title_en, a staff rename of that field
    after the first import makes the second run blind to the existing row —
    it would create a second ProfessionalService for the same
    professional+category instead of finding the first one, breaking the
    command's own idempotency guarantee (spec §38).
    """
    legal = ServiceCategory.objects.get(slug="legal")
    pro = build_professional("m@example.com", slug="renamed-pro", display_name="Renamed Pro")
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {
                    "legacy_id": "60",
                    "slug": "renamed-pro",
                    "display_name": "Renamed Pro",
                    "address": "",
                    "categories": ["legal"],
                }
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    service = ProfessionalService.objects.get(professional=pro, category=legal)
    assert service.title_en == "Legal"

    # Simulate a staff edit of the imported row's title.
    service.title_en = "Legal advice (staff renamed)"
    service.save(update_fields=["title_en", "updated_at"])

    call_command("import_legacy_directory", f"--source={source}")

    services = ProfessionalService.objects.filter(professional=pro, category=legal)
    assert services.count() == 1
    assert services.get().title_en == "Legal advice (staff renamed)"


@pytest.mark.django_db
def test_a_legacy_service_record_maps_to_a_category_and_never_deactivates_an_seo_row(tmp_path):
    source = write_source(
        tmp_path,
        {
            "services": [
                {"legacy_id": "s1", "slug": "legal", "name": "Legal", "description": "Legacy."}
            ],
            "providers": [],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    mapping = LegacyDirectoryMapping.objects.get(legacy_identifier="s1")
    assert mapping.resolution == LegacyDirectoryMapping.Resolution.MAPPED
    assert mapping.target_type == LegacyDirectoryMapping.TargetType.SERVICE_CATEGORY

    from audit.models import AuditEvent

    legal = ServiceCategory.objects.get(slug="legal")
    assert legal.is_active is True
    assert legal.has_seo_page is True
    assert legal.description_en == "Legacy."

    # The copied description is a ServiceCategory write, so it went through
    # save_service_category and left an audit row with a system actor.
    event = AuditEvent.objects.get(action="service_category.updated", target_id=str(legal.pk))
    assert event.actor_user is None
    assert event.actor_type == AuditEvent.ActorType.SYSTEM
    assert event.source == AuditEvent.Source.TASK
    assert event.before["description_en"] == ""
    assert event.after["description_en"] == "Legacy."


@pytest.mark.django_db
def test_the_command_is_idempotent(tmp_path):
    build_professional("g@example.com", slug="idem-pro", display_name="Idem Pro")
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {"legacy_id": "10", "slug": "idem-pro", "display_name": "Idem Pro", "address": ""}
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")
    call_command("import_legacy_directory", f"--source={source}")

    assert LegacyDirectoryMapping.objects.filter(legacy_identifier="10").count() == 1


@pytest.mark.django_db
def test_a_second_run_over_a_full_source_changes_nothing(tmp_path, capsys):
    """Spec §38 idempotency, measured rather than asserted per-row.

    The whole mutable surface of the import — mapping rows, professional
    services, audit events and the copied descriptions — is snapshotted after
    run one and compared after run two.
    """
    pro = build_professional("i@example.com", slug="full-pro", display_name="Full Pro")
    build_professional("j@example.com", slug="dup-a", display_name="Twin Co", city="Livorno")
    source = write_source(
        tmp_path,
        {
            "services": [
                {
                    "legacy_id": "s2",
                    "slug": "transport-delivery",
                    "name": "Transport and delivery",
                    "description": "Legacy transport blurb.",
                },
                {"legacy_id": "s3", "slug": "no-such-category", "name": "Nothing", "description": ""},
            ],
            "providers": [
                {
                    "legacy_id": "30",
                    "slug": "full-pro",
                    "display_name": "Full Pro",
                    "address": "",
                    "description": "Legacy copy.",
                    "categories": ["legal"],
                },
                {
                    "legacy_id": "31",
                    "slug": "dup-b",
                    "display_name": "Twin Co",
                    "address": "Palma de Mallorca",
                },
                {"legacy_id": "32", "slug": "vanished", "display_name": "Vanished", "address": ""},
            ],
        },
    )

    from audit.models import AuditEvent

    def snapshot():
        pro.refresh_from_db()
        return {
            "mappings": sorted(
                LegacyDirectoryMapping.objects.values_list(
                    "legacy_kind",
                    "legacy_identifier",
                    "legacy_slug",
                    "normalized_name",
                    "normalized_address",
                    "target_type",
                    "target_id",
                    "resolution",
                    "notes",
                ),
                key=str,
            ),
            "services": sorted(
                ProfessionalService.objects.values_list(
                    "professional_id", "category_id", "title_en"
                ),
                key=str,
            ),
            "audit_events": AuditEvent.objects.count(),
            "category_descriptions": sorted(
                ServiceCategory.objects.values_list("slug", "description_en"), key=str
            ),
            "professional_description": pro.description,
        }

    call_command("import_legacy_directory", f"--source={source}")
    capsys.readouterr()
    before = snapshot()
    assert before["mappings"], "the first run must actually have written something"

    call_command("import_legacy_directory", f"--source={source}")
    second_report = capsys.readouterr().out

    assert snapshot() == before
    # Run two finds nothing left to copy — the report says so explicitly.
    assert "descriptions copied: 0" in second_report
    assert "categories attached: 0" in second_report


@pytest.mark.django_db
def test_dry_run_writes_nothing(tmp_path, capsys):
    build_professional("h@example.com", slug="dry-pro", display_name="Dry Pro")
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {"legacy_id": "11", "slug": "dry-pro", "display_name": "Dry Pro", "address": ""}
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}", "--dry-run")

    assert LegacyDirectoryMapping.objects.count() == 0
    assert "DRY RUN" in capsys.readouterr().out


@pytest.mark.django_db
def test_a_dry_run_never_copies_a_description_or_writes_an_audit_row(tmp_path):
    from audit.models import AuditEvent

    pro = build_professional("k@example.com", slug="dry-desc", display_name="Dry Desc")
    source = write_source(
        tmp_path,
        {
            "services": [
                {
                    "legacy_id": "s4",
                    "slug": "nautical-marketing",
                    "name": "Nautical marketing",
                    "description": "Legacy marketing blurb.",
                }
            ],
            "providers": [
                {
                    "legacy_id": "40",
                    "slug": "dry-desc",
                    "display_name": "Dry Desc",
                    "address": "",
                    "description": "Legacy copy.",
                    "categories": ["legal"],
                }
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}", "--dry-run")

    pro.refresh_from_db()
    assert pro.description == ""
    assert ServiceCategory.objects.get(slug="nautical-marketing").description_en == ""
    assert ProfessionalService.objects.count() == 0
    assert LegacyDirectoryMapping.objects.count() == 0
    assert AuditEvent.objects.filter(action="service_category.updated").count() == 0


@pytest.mark.django_db
def test_a_malformed_source_fails_loudly(tmp_path):
    from django.core.management.base import CommandError

    path = tmp_path / "broken.json"
    path.write_text("{not json", encoding="utf-8")

    with pytest.raises(CommandError):
        call_command("import_legacy_directory", f"--source={path}")


@pytest.mark.django_db
def test_a_missing_source_file_fails_loudly(tmp_path):
    from django.core.management.base import CommandError

    with pytest.raises(CommandError):
        call_command("import_legacy_directory", f"--source={tmp_path / 'absent.json'}")


@pytest.mark.django_db
def test_a_json_array_source_fails_loudly(tmp_path):
    from django.core.management.base import CommandError

    source = write_source(tmp_path, [{"legacy_id": "1"}])

    with pytest.raises(CommandError):
        call_command("import_legacy_directory", f"--source={source}")


@pytest.mark.django_db
def test_a_record_missing_its_legacy_id_fails_loudly_and_writes_nothing(tmp_path):
    from django.core.management.base import CommandError

    build_professional("l@example.com", slug="ok-pro", display_name="Ok Pro")
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {"legacy_id": "50", "slug": "ok-pro", "display_name": "Ok Pro", "address": ""},
                {"slug": "no-id", "display_name": "No Id", "address": ""},
            ],
        },
    )

    with pytest.raises(CommandError):
        call_command("import_legacy_directory", f"--source={source}")

    # The good record in the same file is rolled back with the bad one.
    assert LegacyDirectoryMapping.objects.count() == 0


@pytest.mark.django_db
def test_the_report_states_that_canonical_tags_and_the_sitemap_regenerate_themselves(
    tmp_path, capsys
):
    source = write_source(tmp_path, {"services": [], "providers": []})

    call_command("import_legacy_directory", f"--source={source}")

    assert "sitemap and canonical tags regenerate from the database" in capsys.readouterr().out

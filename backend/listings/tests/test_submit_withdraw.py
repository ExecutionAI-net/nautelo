import pytest
from django.db import transaction
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.models import ListingRevision
from listings.signals import (
    listing_initial_submitted,
    listing_other_model_submitted,
    listing_revision_submitted,
)
from listings.submissions import submit_listing_revision
from listings.tests.factories import (
    make_brand,
    make_media,
    make_private_listing,
    make_revision,
    make_snapshot,
    other_model_for,
)
from platform_settings.services import set_feature_flag


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


def _seller(email="private-seller@example.com"):
    return make_user(email, role=UserRole.PRIVATE_SELLER, verified=True)


def _staff(email="staff@example.com"):
    return make_user(email)


def _complete_payload(media_id):
    return {
        "title_en": "Oceanis 46.1, one owner",
        "description_en": "Full service history.",
        "specifications": {"length_m": "14.6"},
        "location_country": "IT",
        "location_city": "Genoa",
        "price": "125000.00",
        "currency": "EUR",
        "media_ids": [str(media_id)],
    }


def _ready_private_listing(owner, **listing_kwargs):
    listing = make_private_listing(owner=owner, **listing_kwargs)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(listing, payload=_complete_payload(image.pk))
    return listing, revision, image


@pytest.mark.django_db
def test_submitting_moves_the_listing_and_revision_into_the_pending_states(api, workflow_enabled):
    owner = _seller()
    listing, revision, _ = _ready_private_listing(owner)
    api.force_authenticate(owner)

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version},
        format="json",
    )

    assert response.status_code == 200
    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert revision.state == RevisionStatus.SUBMITTED
    assert revision.submitted_by_id == owner.pk
    assert revision.submitted_at is not None
    assert listing.publication_source == "FREE_ENTITLEMENT"
    assert listing.published_at is None


@pytest.mark.django_db
def test_a_pending_listing_is_not_published(api, workflow_enabled):
    owner = _seller()
    listing, revision, _ = _ready_private_listing(owner)
    api.force_authenticate(owner)

    api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    listing.refresh_from_db()
    assert listing.current_public_snapshot_id is None
    assert listing.status != ListingStatus.PUBLISHED


@pytest.mark.django_db
def test_submitting_records_an_audit_event(api, workflow_enabled):
    owner = _seller()
    listing, revision, _ = _ready_private_listing(owner)
    api.force_authenticate(owner)

    api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    event = AuditEvent.objects.get(action="listing.submitted")
    assert event.actor_user_id == owner.pk
    assert event.target_type == "listings.ListingRevision"
    assert event.target_id == str(revision.pk)
    assert event.after["state"] == RevisionStatus.SUBMITTED


@pytest.mark.django_db
def test_an_incomplete_draft_cannot_be_submitted(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, price=None)
    revision = make_revision(listing, payload={"title_en": "Only a title"})
    api.force_authenticate(owner)

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["price"] == [
        "This field is required before the listing can be submitted."
    ]
    listing.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT


@pytest.mark.django_db
def test_media_that_is_not_ready_blocks_submission(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.PROCESSING)
    revision = make_revision(listing, payload=_complete_payload(image.pk))
    api.force_authenticate(owner)

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["media_ids"][0]
    assert response.data["error"]["code"] == "validation_error"
    listing.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT


@pytest.mark.django_db
def test_media_belonging_to_another_listing_is_refused(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    stranger_image = make_media(
        make_private_listing(owner=_seller("stranger@example.com")),
        media_type=MediaType.IMAGE,
        status=MediaStatus.READY,
    )
    revision = make_revision(listing, payload=_complete_payload(stranger_image.pk))
    api.force_authenticate(owner)

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_exceeding_the_private_base_allowance_blocks_submission(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    first = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=0)
    make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=1)
    revision = make_revision(listing, payload=_complete_payload(first.pk))
    api.force_authenticate(owner)

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["media_ids"][0]


@pytest.mark.django_db
def test_submitting_twice_is_refused(api, workflow_enabled):
    owner = _seller()
    listing, revision, _ = _ready_private_listing(owner)
    api.force_authenticate(owner)
    api.post(reverse("listing-submit", kwargs={"listing_id": listing.pk}),
             {"version": revision.version}, format="json")

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version + 1}, format="json",
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] == "invalid_revision_state"


@pytest.mark.django_db
def test_withdrawing_an_initial_submission_returns_the_listing_to_draft(api, workflow_enabled):
    owner = _seller()
    listing, revision, _ = _ready_private_listing(owner)
    api.force_authenticate(owner)
    api.post(reverse("listing-submit", kwargs={"listing_id": listing.pk}),
             {"version": revision.version}, format="json")
    revision.refresh_from_db()

    response = api.post(
        reverse("listing-withdraw", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    assert response.status_code == 200
    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT
    assert revision.state == RevisionStatus.WITHDRAWN


@pytest.mark.django_db
def test_withdrawing_a_post_publication_revision_leaves_the_listing_published(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    snapshot = make_snapshot(listing, approved_by=_staff())
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing, base_snapshot=snapshot, payload=_complete_payload(image.pk),
        state=RevisionStatus.SUBMITTED, submitted_by=owner, submitted_at=timezone.now(),
    )
    api.force_authenticate(owner)

    api.post(reverse("listing-withdraw", kwargs={"listing_id": listing.pk}),
             {"version": revision.version}, format="json")

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot_id == snapshot.pk
    assert revision.state == RevisionStatus.WITHDRAWN


@pytest.mark.django_db
def test_a_stale_version_cannot_submit(api, workflow_enabled):
    owner = _seller()
    listing, revision, _ = _ready_private_listing(owner)
    api.force_authenticate(owner)

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version + 5}, format="json",
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] == "stale_version"


class SubmissionSignalTests(TestCase):
    """Uses TestCase for captureOnCommitCallbacks (spec §2.3, §27 acceptance)."""

    def setUp(self):
        set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)
        self.owner = _seller()
        self.listing = make_private_listing(owner=self.owner)
        image = make_media(
            self.listing, media_type=MediaType.IMAGE, status=MediaStatus.READY
        )
        self.revision = make_revision(self.listing, payload=_complete_payload(image.pk))
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_an_initial_submission_fires_both_signals_after_commit(self):
        received = []
        listing_initial_submitted.connect(
            lambda **kwargs: received.append("initial"), weak=False
        )
        listing_revision_submitted.connect(
            lambda **kwargs: received.append("revision"), weak=False
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse("listing-submit", kwargs={"listing_id": self.listing.pk}),
                {"version": self.revision.version},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(sorted(received), ["initial", "revision"])

    def test_no_signal_is_sent_before_the_transaction_commits(self):
        """The one test that can tell `transaction.on_commit(...)` apart from a
        plain in-line `.send(...)`: the callbacks are captured but NOT run, so a
        signal that fired inside the atomic block would already be in `received`.
        """
        received = []
        listing_revision_submitted.connect(
            lambda **kwargs: received.append("revision"), weak=False
        )

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            response = self.client.post(
                reverse("listing-submit", kwargs={"listing_id": self.listing.pk}),
                {"version": self.revision.version},
                format="json",
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(received, [])

        self.assertEqual(received, [])
        self.assertEqual(len(callbacks), 1)
        for callback in callbacks:
            callback()
        self.assertEqual(received, ["revision"])

    def test_a_rolled_back_submission_sends_nothing(self):
        """Spec §27 acceptance test 1: "Rolled-back submission sends no email/WS
        event." The service succeeds and queues its callbacks, then the enclosing
        transaction rolls back, which must discard them unrun.
        """
        received = []
        listing_revision_submitted.connect(
            lambda **kwargs: received.append("revision"), weak=False
        )
        listing_initial_submitted.connect(
            lambda **kwargs: received.append("initial"), weak=False
        )

        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    submit_listing_revision(
                        listing=self.listing,
                        actor=self.owner,
                        expected_version=self.revision.version,
                    )
                    raise RuntimeError("something later in the request blew up")

        self.assertEqual(callbacks, [])
        self.assertEqual(received, [])
        self.revision.refresh_from_db()
        self.assertEqual(self.revision.state, RevisionStatus.DRAFT)

    def test_a_failed_submission_fires_no_signal(self):
        received = []
        listing_revision_submitted.connect(
            lambda **kwargs: received.append("revision"), weak=False
        )
        self.revision.payload = {"title_en": "Incomplete"}
        self.revision.save(update_fields=["payload"])

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse("listing-submit", kwargs={"listing_id": self.listing.pk}),
                {"version": self.revision.version},
                format="json",
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(received, [])

    def test_an_other_model_submission_fires_the_taxonomy_signal(self):
        brand = make_brand("Nameless Yard")
        listing = make_private_listing(
            owner=self.owner, brand=brand, model=other_model_for(brand),
            custom_model_name="McKenzie",
        )
        image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
        revision = make_revision(listing, payload=_complete_payload(image.pk))
        received = []
        listing_other_model_submitted.connect(
            lambda **kwargs: received.append(kwargs["revision"]), weak=False
        )

        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(
                reverse("listing-submit", kwargs={"listing_id": listing.pk}),
                {"version": revision.version},
                format="json",
            )

        self.assertEqual(received, [ListingRevision.objects.get(pk=revision.pk)])

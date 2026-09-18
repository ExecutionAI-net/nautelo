"""Post-commit domain events for the listing workflow (spec §2.3, §13.4, §27.1).

These are real Django signals with, for now, no receivers: spec Phase 18 (§27)
owns notification fan-out and connects to them there. Every one is sent from
inside transaction.on_commit(), so a rolled-back transaction emits nothing
(spec §27 acceptance test 1).

Every signal is sent with `sender=listings.models.ListingRevision` and the
keyword argument `revision` (a ListingRevision), with two exceptions:

  * `listing_published` is sent with `sender=listings.models.BoatListing` and
    the keyword arguments `listing` and `snapshot`.
  * `listing_revision_approved` additionally carries `auto_approved: bool`
    (Phase 12, spec §21) — True when a broker organization's auto-approval
    policy published the revision rather than a moderator. Receivers must accept
    it through `**kwargs` and must not assume a human decided.
"""

import django.dispatch

listing_initial_submitted = django.dispatch.Signal()
listing_revision_submitted = django.dispatch.Signal()
listing_other_model_submitted = django.dispatch.Signal()
listing_revision_withdrawn = django.dispatch.Signal()
listing_revision_approved = django.dispatch.Signal()
listing_revision_changes_requested = django.dispatch.Signal()
listing_revision_rejected = django.dispatch.Signal()
listing_published = django.dispatch.Signal()

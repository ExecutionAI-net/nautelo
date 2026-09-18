import hashlib

from django.utils import timezone

from analytics.enums import UserAgentClass, ViewerType
from analytics.models import ListingView


def fake_hash(seed: str) -> str:
    """A well-formed 64-char lowercase hex digest for tests that need a hash
    without going through an IP. Real hashes come from common.ip.hash_client_ip."""
    return hashlib.sha256(seed.encode()).hexdigest()


# Both timestamps are written explicitly, from ONE captured `now`. Neither field
# auto-generates: `first_viewed_at` is a plain DateTimeField precisely so that a
# value generated at INSERT time cannot end up later than the `last_seen_at` the
# caller captured a moment earlier, which would violate the
# `analytics_view_last_seen_not_before_first_viewed` CHECK on every first row.
def make_user_view(listing, *, user, **kwargs):
    now = timezone.now()
    defaults = {
        "listing": listing,
        "viewer_type": ViewerType.USER,
        "viewer_user": user,
        "viewer_hash": None,
        "first_viewed_at": now,
        "last_seen_at": now,
        "user_agent_class": UserAgentClass.HUMAN,
    }
    defaults.update(kwargs)
    return ListingView.objects.create(**defaults)


def make_anonymous_view(listing, *, viewer_hash=None, **kwargs):
    now = timezone.now()
    defaults = {
        "listing": listing,
        "viewer_type": ViewerType.ANONYMOUS,
        "viewer_user": None,
        "viewer_hash": viewer_hash or fake_hash(f"anon-{listing.pk}"),
        "first_viewed_at": now,
        "last_seen_at": now,
        "user_agent_class": UserAgentClass.HUMAN,
    }
    defaults.update(kwargs)
    return ListingView.objects.create(**defaults)

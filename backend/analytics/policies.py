"""Who counts, and as whom (spec §19.1, §19.2, §36.2).

Everything §19 decides before a row exists lives here, as functions with no side
effects beyond one membership lookup. `analytics.recording` performs the write and
asks no questions of its own; this module answers the questions and writes nothing.
"""

import re
from dataclasses import dataclass

from accounts.enums import UserRole
from common.ip import canonical_client_ip, hash_client_ip
from listings.enums import ListingStatus

from .enums import UserAgentClass, ViewerType

# Spec §19.1 excludes "known verified bots" and spec §36.2 says "Known bots are
# excluded by explicit detection policy; uncertain clients may count and are
# labeled operational limitation." The policy below is deliberately narrow: it
# names automation by TOKEN, never by a loose substring, because a false BOT
# verdict silently deletes a genuine human's view. That matters concretely now:
# people arrive from DuckDuckGo's browser, Pinterest's and Yandex's in-app
# browsers, and (Phase 20) WhatsApp shares, and their UAs contain "duckduckgo",
# "pinterest", "yandex" (and Cubot phones contain "bot"). None of those may be
# read as a bot. A crawler we do not recognise is counted as UNKNOWN/HUMAN;
# that is the limitation §36.2 accepts.
#
# 1. BOT_USER_AGENT_PATTERN: a crawler that names itself "<name>bot" with a
#    version or descriptor after it (Googlebot/2.1, bingbot/2.0, DuckDuckBot/1.1,
#    YandexBot/3.0, Twitterbot/1.0, Slackbot-LinkExpanding, TelegramBot (like ..),
#    Slackbot 1.0, ".../bot.html"). It does NOT match "CUBOT NOTE 21".
BOT_USER_AGENT_PATTERN = re.compile(r"bot(?:[/)-]|\s+(?:v?\d|\()|\.html)")

# 2. BOT_USER_AGENT_MARKERS: lowercase substrings that are unambiguous on their
#    own (each is an automation identity a human browser never sends). Keep the
#    groups; append, do not reorder. WhatsApp's link-preview crawler is
#    deliberately absent: its "WhatsApp/2.x" token is not one we could verify
#    is absent from the in-app browser, and link previews are not counted
#    anyway (they are not human GETs of the page).
BOT_USER_AGENT_MARKERS = (
    # Generic self-identification.
    "crawler",
    "spider",
    "scraper",
    # Fetchers that do not contain "bot".
    "slurp",  # Yahoo
    "baiduspider",
    "facebookexternalhit",
    "embedly",
    "quora link preview",
    # Headless browsers and automation drivers.
    "headlesschrome",
    "phantomjs",
    "puppeteer",
    "playwright",
    "selenium",
    # Scripted HTTP clients. A human browser never sends one of these.
    "curl",
    "wget",
    "libwww-perl",
    "python-requests",
    "python-urllib",
    "httpie",
    "go-http-client",
    "java/",
    "okhttp",
    "axios",
    "node-fetch",
    "guzzle",
    # Uptime and monitoring agents (spec §19.1 "health check"). This project's
    # own health endpoint is a different URL and cannot reach a listing.
    "pingdom",
    "uptimerobot",
    "statuscake",
    "site24x7",
    "newrelicpinger",
    "datadog",
    "check_http",
    "nagios",
)

# Spec §19.1 excludes "prefetch/prerender". `Sec-Purpose` is the current standard
# (Chrome/Edge speculation rules); the rest are the legacy spellings still sent by
# Safari, Firefox and older Chromium. A match on ANY of them is a refusal, because
# a false negative silently inflates a seller's metric while a false positive only
# declines to count one page view.
PREFETCH_META_KEYS = (
    ("HTTP_SEC_PURPOSE", ("prefetch", "prerender")),
    ("HTTP_PURPOSE", ("prefetch", "preview", "prerender")),
    ("HTTP_X_PURPOSE", ("prefetch", "preview", "prerender")),
    ("HTTP_X_MOZ", ("prefetch", "prerender")),
)


def classify_user_agent(user_agent: str | None) -> str:
    """Spec §11.7's `user_agent_class`. UNKNOWN counts; BOT does not."""
    normalized = (user_agent or "").strip().lower()
    if not normalized:
        return UserAgentClass.UNKNOWN
    if BOT_USER_AGENT_PATTERN.search(normalized) or any(
        marker in normalized for marker in BOT_USER_AGENT_MARKERS
    ):
        return UserAgentClass.BOT
    return UserAgentClass.HUMAN


def is_prefetch_request(request) -> bool:
    for meta_key, markers in PREFETCH_META_KEYS:
        value = (request.META.get(meta_key) or "").strip().lower()
        if value and any(marker in value for marker in markers):
            return True
    return False


def _usable(user) -> bool:
    return bool(
        user is not None
        and getattr(user, "is_authenticated", False)
        and getattr(user, "is_active", False)
    )


def viewer_is_staff(user) -> bool:
    """Spec §19.1: "Viewer is staff."

    Broader than accounts.services.is_staff_moderator(), on purpose: that helper
    also requires a Django group because it authorizes an action. Exclusion is the
    opposite kind of decision — a staff account with no group yet is still staff
    browsing the catalogue, and counting them would corrupt a seller's number.
    """
    if not _usable(user):
        return False
    return bool(
        getattr(user, "is_superuser", False)
        or getattr(user, "primary_role", None) == UserRole.STAFF
    )


def viewer_is_listing_insider(user, listing) -> bool:
    """Spec §19.1: the private listing owner, or a member of the owning broker.

    Not accounts.services.active_broker_membership(): that filters on
    `broker__status=ACTIVE`, which is right for authorization (a suspended org
    grants nothing) and wrong here (a suspended org's staff are still insiders).
    Capability flags are ignored for the same reason — they decide what a member
    may do, not whether they are on the inside. `is_active=False` is deliberately
    NOT excluded: a removed ex-employee is a genuine outside viewer.
    """
    # Function-local import: brokers.admin imports accounts.services, and keeping
    # every brokers import inside the function body matches the pattern
    # accounts.services already uses to stay clear of app-loading cycles.
    from brokers.models import BrokerMembership

    if not _usable(user):
        return False

    if listing.owner_user_id is not None and str(listing.owner_user_id) == str(user.pk):
        return True

    if listing.broker_id is None:
        return False

    return BrokerMembership.objects.filter(
        user=user, broker_id=listing.broker_id, is_active=True
    ).exists()


@dataclass(frozen=True)
class ViewerIdentity:
    """Spec §19.2's resolved identity. Exactly one of the two columns is set."""

    viewer_type: str
    viewer_user: object | None
    viewer_hash: str | None
    user_agent_class: str

    def lookup(self) -> dict:
        """The filter that finds this identity's existing row, if any."""
        if self.viewer_user is not None:
            return {"viewer_user": self.viewer_user}
        return {"viewer_hash": self.viewer_hash}


def resolve_viewer_identity(*, request, listing) -> ViewerIdentity | None:
    """Spec §19.3 step 1. `None` means "this request does not count".

    The order below is the order of spec §19.1's own list, cheapest checks first,
    so the membership query at the end runs only for requests that could count.
    """
    # "a successful human GET". DRF routes HEAD to the same handler as GET while
    # leaving request.method as "HEAD", so this is also §19.1's HEAD exclusion.
    if request.method != "GET":
        return None

    if is_prefetch_request(request):
        return None

    user_agent_class = classify_user_agent(request.META.get("HTTP_USER_AGENT"))
    if user_agent_class == UserAgentClass.BOT:
        return None

    # "Listing is not published." The caller already filtered on
    # listings.views.published_listings_queryset(); this is the same rule
    # restated so the service is safe to call from anywhere (spec §36.2's
    # "controlled view-record endpoint" is the second such caller, if it is ever
    # built). Phase 11 contract rule 1 forbids re-deriving public visibility
    # loosely, and this is deliberately the identical pair of conditions.
    if (
        listing.status != ListingStatus.PUBLISHED
        or listing.current_public_snapshot_id is None
    ):
        return None

    user = getattr(request, "user", None)
    if _usable(user):
        if viewer_is_staff(user) or viewer_is_listing_insider(user, listing):
            return None
        # Spec §19.2: "If an anonymous viewer later logs in, the authenticated
        # identity may count separately; do not attempt risky probabilistic
        # identity merging." So: no lookup of this request's IP hash here, and no
        # attempt to retire the anonymous row. Two rows, by design.
        return ViewerIdentity(
            viewer_type=ViewerType.USER,
            viewer_user=user,
            viewer_hash=None,
            user_agent_class=user_agent_class,
        )

    client_ip = canonical_client_ip(request)
    if client_ip is None:
        # No address means no uniqueness control at all — every such request
        # would be a fresh "viewer". Refusing is the only honest answer, and the
        # model's "exactly one identity" constraint forbids the row anyway.
        return None

    return ViewerIdentity(
        viewer_type=ViewerType.ANONYMOUS,
        viewer_user=None,
        viewer_hash=hash_client_ip(client_ip),
        user_agent_class=user_agent_class,
    )

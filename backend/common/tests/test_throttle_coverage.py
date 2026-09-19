"""Every public or mutating API view must declare a throttle scope (spec 30.4).

The project's default throttle is a ScopedRateThrottle subclass, and a scoped
throttle on a view without `throttle_scope` is a silent no-op. This walks the
URLconf so a new endpoint cannot ship unthrottled unnoticed.
"""

from django.urls import get_resolver
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

# Views that legitimately have no scope: infrastructure probes and the Stripe
# webhook (authenticated by signature, must never be rate limited away).
EXEMPT = {
    "HealthCheckView",
    "StripeWebhookView",
    "SessionView",
    # Chooses its scope per HTTP method inside initial() (read vs send bucket).
    "ConversationMessagesView",
}


def _views(patterns):
    for entry in patterns:
        if hasattr(entry, "url_patterns"):
            yield from _views(entry.url_patterns)
        else:
            cls = getattr(entry.callback, "cls", None)
            if cls is not None and issubclass(cls, APIView):
                yield entry, cls


def test_every_anonymous_or_mutating_api_view_has_a_throttle_scope():
    missing = []
    for entry, cls in _views(get_resolver().url_patterns):
        route = str(entry.pattern)
        if cls.__name__ in EXEMPT:
            continue
        anonymous = any(p is AllowAny for p in getattr(cls, "permission_classes", []))
        mutating = any(
            m in getattr(cls, "http_method_names", [])
            and hasattr(cls, m)
            for m in ("post", "put", "patch", "delete")
        )
        if (anonymous or mutating) and not getattr(cls, "throttle_scope", None):
            missing.append(f"{cls.__name__} ({route})")
    assert not missing, "Views without throttle_scope: " + ", ".join(sorted(set(missing)))

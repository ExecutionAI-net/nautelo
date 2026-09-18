"""Read-only queries over the conversation store (spec §11.8).

Only foreign keys to other apps are used here, never Python imports of them,
so the one-directional dependency arrow `messaging` -> nothing is preserved
(see models.py's module docstring).
"""

from messaging.models import ContactAccessGrant


def active_contact_grant(viewer, *, broker=None, professional=None):
    """The viewer's live grant for exactly ONE target, or None (spec §16).

    The ONE definition of "an active grant" in this codebase — every caller
    reads through this function so that "active" cannot drift between them.

    Both target columns are always filtered, never just the one the caller
    passed: `filter(broker=None)` becomes `broker__isnull=True`, so a grant for
    a professional can never satisfy a lookup for a broker (or the reverse),
    which is spec §16's "sending to Broker A does not unlock Broker B" applied
    across target kinds as well as within one.

    `revoked_at__isnull=True` is the revocation rule, and `-granted_at` ordering
    means a database that somehow holds two active rows degrades to "newest
    wins" on read rather than raising — the model's partial unique constraints
    are what prevent that pair from existing in the first place.
    """
    if (broker is None) == (professional is None):
        raise ValueError("Pass exactly one of broker= or professional=.")
    return (
        ContactAccessGrant.objects.filter(
            viewer=viewer,
            broker=broker,
            professional=professional,
            revoked_at__isnull=True,
        )
        .order_by("-granted_at")
        .first()
    )
